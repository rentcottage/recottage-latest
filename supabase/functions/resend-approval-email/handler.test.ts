// Security tests for resend-approval-email.
//
// Run (Node >= 22.18 / 24, built-in TypeScript type stripping):
//   node --test supabase/functions/resend-approval-email/handler.test.ts
//
// Uses fakes for the database and email provider — no network, no secrets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHandler,
  escapeHtml,
  headerSafe,
  secretsMatch,
  type ApprovalApplication,
  type EmailMessage,
  type HandlerDeps,
} from './handler.ts';

const ADMIN_PASSWORD = 'correct-horse-battery-staple-test-only';
const APP_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_APP_ID = '99999999-8888-4777-8666-555555555555';
const HOST_EMAIL = 'host.private@example.test';
const OTHER_HOST_EMAIL = 'other.host.private@example.test';
const HOST_FIRST = 'Nino';
const HOST_LAST = 'Privatesurname';

function makeApp(overrides: Partial<ApprovalApplication> = {}): ApprovalApplication {
  return {
    id: APP_ID,
    status: 'approved',
    title: 'Mountain Cottage',
    location: 'Mestia, Svaneti',
    price_per_night: 180,
    host_first_name: HOST_FIRST,
    host_last_name: HOST_LAST,
    host_email: HOST_EMAIL,
    ...overrides,
  };
}

interface Harness {
  handler: (req: Request) => Promise<Response>;
  sent: EmailMessage[];
  loads: string[];
  logs: { event: string; fields: Record<string, string | number> }[];
}

function harness(opts: {
  apps?: Record<string, ApprovalApplication>;
  adminPassword?: string | undefined;
  sendOk?: boolean;
  loadThrows?: boolean;
} = {}): Harness {
  const apps = opts.apps ?? { [APP_ID]: makeApp(), [OTHER_APP_ID]: makeApp({ id: OTHER_APP_ID, host_email: OTHER_HOST_EMAIL }) };
  const sent: EmailMessage[] = [];
  const loads: string[] = [];
  const logs: Harness['logs'] = [];
  const deps: HandlerDeps = {
    adminPassword: 'adminPassword' in opts ? opts.adminPassword : ADMIN_PASSWORD,
    loadApplication: async (id) => {
      loads.push(id);
      if (opts.loadThrows) throw new Error(`relation error mentioning ${HOST_EMAIL}`);
      return apps[id] ?? null;
    },
    sendEmail: async (message) => {
      sent.push(message);
      return opts.sendOk === false ? { ok: false, status: 422 } : { ok: true, status: 200 };
    },
    log: (event, fields) => logs.push({ event, fields }),
  };
  return { handler: createHandler(deps), sent, loads, logs };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://fn.local/functions/v1/resend-approval-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const adminHeaders = { 'x-admin-password': ADMIN_PASSWORD };

/** Fails if any private value appears anywhere in the response (status text, headers or body). */
async function assertNoPrivateData(res: Response, extra: string[] = []) {
  const text = await res.clone().text();
  const headerText = [...res.headers.entries()].map(([k, v]) => `${k}:${v}`).join('\n');
  for (const secret of [HOST_EMAIL, OTHER_HOST_EMAIL, HOST_LAST, ADMIN_PASSWORD, ...extra]) {
    assert.ok(!text.includes(secret), `response body leaked: ${secret}`);
    assert.ok(!headerText.includes(secret), `response headers leaked: ${secret}`);
  }
}

function assertLogsClean(logs: Harness['logs']) {
  const all = JSON.stringify(logs);
  for (const secret of [HOST_EMAIL, OTHER_HOST_EMAIL, HOST_FIRST, HOST_LAST, ADMIN_PASSWORD, 'wrong-password']) {
    assert.ok(!all.includes(secret), `log leaked: ${secret}`);
  }
}

// ── 1. No authorization ─────────────────────────────────────────────────────

test('1a. no x-admin-password header → 401, nothing loaded or sent', async () => {
  const h = harness();
  const res = await h.handler(post({ applicationId: APP_ID }));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Unauthorized' });
  assert.equal(h.loads.length, 0);
  assert.equal(h.sent.length, 0);
});

test('1b. only the public anon key as Bearer/apikey (current gateway posture) → 401', async () => {
  const h = harness();
  const res = await h.handler(post({ applicationId: APP_ID }, {
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig',
    apikey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig',
  }));
  assert.equal(res.status, 401);
  assert.equal(h.sent.length, 0);
});

test('1c. password in the JSON body instead of the header → 401 (body is not an auth channel)', async () => {
  const h = harness();
  const res = await h.handler(post({ applicationId: APP_ID, adminPassword: ADMIN_PASSWORD }));
  assert.equal(res.status, 401);
  assert.equal(h.sent.length, 0);
});

test('1d. server misconfigured (no ADMIN_PANEL_PASSWORD) → 401 even for an empty header', async () => {
  for (const pw of [undefined, '']) {
    const h = harness({ adminPassword: pw });
    const res = await h.handler(post({ applicationId: APP_ID }, { 'x-admin-password': '' }));
    assert.equal(res.status, 401);
    assert.equal(h.sent.length, 0);
  }
});

test('1e. legacy GET ?applicationId= fallback is removed → 405, nothing sent', async () => {
  const h = harness();
  const res = await h.handler(new Request(`https://fn.local/?applicationId=${APP_ID}`, { method: 'GET', headers: adminHeaders }));
  assert.equal(res.status, 405);
  assert.equal(h.loads.length, 0);
  assert.equal(h.sent.length, 0);
});

// ── 2. Wrong admin password ─────────────────────────────────────────────────

test('2. wrong / near-miss admin passwords → 401, nothing loaded or sent', async () => {
  const h = harness();
  // Leading/trailing whitespace is not tested: the Fetch Headers API trims header values by spec.
  for (const pw of ['wrong-password', ADMIN_PASSWORD.slice(0, -1), ADMIN_PASSWORD + 'x', ADMIN_PASSWORD.toUpperCase(), 'x'.repeat(ADMIN_PASSWORD.length)]) {
    const res = await h.handler(post({ applicationId: APP_ID }, { 'x-admin-password': pw }));
    assert.equal(res.status, 401, `accepted: ${JSON.stringify(pw.length)}`);
    await assertNoPrivateData(res);
  }
  assert.equal(h.loads.length, 0);
  assert.equal(h.sent.length, 0);
  assertLogsClean(h.logs);
});

// ── 3. Correct admin authorization ──────────────────────────────────────────

test('3. correct admin password → 200 {success:true}, email sent to the stored host email', async () => {
  const h = harness();
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true });
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, HOST_EMAIL);
  assert.equal(h.sent[0].subject, 'Your cottage "Mountain Cottage" has been approved!');
  assert.match(h.sent[0].html, /Congratulations! Your cottage is approved/);
  assert.match(h.sent[0].html, /Mountain Cottage/);
  assert.match(h.sent[0].html, /Hi Nino Privatesurname,/);
  assert.match(h.sent[0].html, /&#x20BE;180/);
  assertLogsClean(h.logs);
});

test('3b. CORS preflight allows the x-admin-password header the admin panel sends', async () => {
  const h = harness();
  const res = await h.handler(new Request('https://fn.local/', { method: 'OPTIONS' }));
  assert.equal(res.status, 200);
  const allowed = (res.headers.get('access-control-allow-headers') ?? '').split(',').map((s) => s.trim());
  for (const hdr of ['x-admin-password', 'apikey', 'authorization', 'content-type']) {
    assert.ok(allowed.includes(hdr), `preflight missing ${hdr}`);
  }
});

// ── 4. Missing / invalid parameters ─────────────────────────────────────────

test('4. missing or malformed applicationId (with valid auth) → 400, nothing sent', async () => {
  const h = harness();
  const cases: unknown[] = [{}, { applicationId: '' }, { applicationId: '   ' }, { applicationId: 123 }, { applicationId: null },
    { applicationId: 'not-a-uuid' }, { applicationId: `${APP_ID}' or 1=1 --` }, { application_id: APP_ID }];
  for (const body of cases) {
    const res = await h.handler(post(body, adminHeaders));
    assert.equal(res.status, 400, `accepted body ${JSON.stringify(body)}`);
  }
  for (const raw of ['not json', '[]', 'null', '"x"']) {
    const res = await h.handler(post(raw, adminHeaders));
    assert.equal(res.status, 400, `accepted raw body ${raw}`);
  }
  assert.equal(h.loads.length, 0);
  assert.equal(h.sent.length, 0);
});

test('4b. missing parameters WITHOUT auth → 401 (auth is checked first, no validation oracle)', async () => {
  const h = harness();
  const res = await h.handler(post({}));
  assert.equal(res.status, 401);
});

// ── 5. Another host's information without admin authorization ───────────────

test('5a. unauthenticated caller cannot trigger or read anything about another host', async () => {
  const h = harness();
  for (const id of [APP_ID, OTHER_APP_ID]) {
    const res = await h.handler(post({ applicationId: id }));
    assert.equal(res.status, 401);
    await assertNoPrivateData(res);
  }
  assert.equal(h.loads.length, 0);
  assert.equal(h.sent.length, 0);
});

test('5b. a caller-supplied recipient/email is ignored — even with auth, mail goes only to the stored host', async () => {
  const h = harness();
  const res = await h.handler(post({
    applicationId: OTHER_APP_ID,
    to: 'attacker@example.test',
    email: 'attacker@example.test',
    host_email: 'attacker@example.test',
    hostEmail: HOST_EMAIL,
  }, adminHeaders));
  assert.equal(res.status, 200);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, OTHER_HOST_EMAIL);
  await assertNoPrivateData(res);
});

test('5c. a browser-supplied host email is never accepted as authorization', async () => {
  const h = harness();
  const res = await h.handler(post({ applicationId: APP_ID, hostEmail: HOST_EMAIL, userEmail: HOST_EMAIL }, { 'x-host-email': HOST_EMAIL }));
  assert.equal(res.status, 401);
  assert.equal(h.sent.length, 0);
});

test('5d. non-approved applications are refused (no false "approved" email)', async () => {
  for (const status of ['pending', 'rejected', 'hidden', null]) {
    const h = harness({ apps: { [APP_ID]: makeApp({ status }) } });
    const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
    assert.equal(res.status, 409, `sent for status ${status}`);
    assert.equal(h.sent.length, 0);
    await assertNoPrivateData(res);
  }
});

// ── 6. Error responses reveal nothing private ───────────────────────────────

test('6a. not found → 404 with generic message', async () => {
  const h = harness({ apps: {} });
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Application not found' });
});

test('6b. database error → 500 without the underlying error text', async () => {
  const h = harness({ loadThrows: true });
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 500);
  await assertNoPrivateData(res, ['relation error']);
  assert.deepEqual(await res.json(), { error: 'Failed to load application' });
  assertLogsClean(h.logs);
});

test('6c. email provider failure → 502 without provider detail or recipient', async () => {
  const h = harness({ sendOk: false });
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 502);
  await assertNoPrivateData(res);
  assert.deepEqual(await res.json(), { error: 'Failed to send email' });
  assertLogsClean(h.logs);
});

test('6d. application without a host email → 422 generic', async () => {
  const h = harness({ apps: { [APP_ID]: makeApp({ host_email: null }) } });
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 422);
  assert.equal(h.sent.length, 0);
  await assertNoPrivateData(res);
});

test('6e. success response contains only {success:true} — no sent_to, property or provider id', async () => {
  const h = harness();
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  await assertNoPrivateData(res, ['Mountain Cottage']);
  assert.deepEqual(Object.keys(await res.json()), ['success']);
});

// ── Injection hardening ─────────────────────────────────────────────────────

test('HTML injection: host-controlled fields are escaped in the email body', async () => {
  const h = harness({
    apps: {
      [APP_ID]: makeApp({
        title: '<a href="https://evil.test">Click to verify</a>',
        location: '<img src=x onerror=alert(1)>',
        host_first_name: '<script>x</script>',
        host_last_name: '"><b>',
        price_per_night: '<i>1</i>',
      }),
    },
  });
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 200);
  const html = h.sent[0].html;
  for (const raw of ['<a href="https://evil.test">', '<img src=x', '<script>', '"><b>', '<i>1</i>']) {
    assert.ok(!html.includes(raw), `unescaped: ${raw}`);
  }
  assert.match(html, /&lt;a href=&quot;https:\/\/evil\.test&quot;&gt;/);
  assert.match(html, /&#x20BE;—/, 'non-numeric price is not rendered');
});

test('Header injection: CR/LF and control characters are stripped from the subject', async () => {
  const h = harness({ apps: { [APP_ID]: makeApp({ title: 'Nice\r\nBcc: attacker@example.test\u0000' + 'x'.repeat(500) }) } });
  const res = await h.handler(post({ applicationId: APP_ID }, adminHeaders));
  assert.equal(res.status, 200);
  const subject = h.sent[0].subject;
  assert.ok(!/[\r\n\u0000]/.test(subject), 'control chars in subject');
  assert.ok(subject.length < 200, 'subject not length-capped');
});

test('helpers: escapeHtml, headerSafe, secretsMatch', async () => {
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(escapeHtml(null), '');
  assert.equal(headerSafe('a\r\nb\tc'), 'a b c');
  assert.equal(await secretsMatch('abc', 'abc'), true);
  assert.equal(await secretsMatch('abc', 'abd'), false);
  assert.equal(await secretsMatch('', ''), false);
  assert.equal(await secretsMatch('abc', ''), false);
});
