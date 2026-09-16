// booking-reminders — host reminder emails for booking requests awaiting
// approval. Invoked ONLY by Supabase Cron. Free of Deno globals and network
// imports so it can be unit-tested (handler.test.ts); index.ts wires in the
// Supabase service client and Resend.
//
// AUTHORIZATION
//   POST only (anything else → 405). The `x-cron-secret` header must match
//   CRON_SECRET (constant-time). No user session, API key or admin password is
//   accepted instead. The request body is never read.
//
// ELIGIBILITY (server-side only)
//   status = 'pending_host_approval' AND approval_deadline in the future.
//     remaining ≤ 8h  → "16h" (urgent) reminder, if reminder_16h_sent = false.
//                        Takes precedence; claiming it also sets
//                        reminder_12h_sent so the older reminder never follows.
//     remaining ≤ 12h → "12h" reminder, if both flags are false.
//   Timing is based on approval_deadline, never created_at.
//
// CLAIM BEFORE SEND
//   Each reminder is claimed with one conditional UPDATE that succeeds only if
//   the booking is still pending, the deadline is still in the future and the
//   flag is still false. Only the request that gets the row back may send, so
//   sequential or concurrent runs send at most one email per booking + type.
//
// FAILURE SEMANTICS (per booking + reminder type)
//   sent (2xx)             → claim stays; `sent` delivery log row.
//   permanent (422, or 400 with an invalid-recipient code)
//                          → claim stays (never retried); recipient added to
//                            blocked_emails; `permanent_failure` log row.
//   transient (network, 429, 5xx, any other non-2xx)
//                          → `transient_failure` log row first. Only if that
//                            row was written AND fewer than MAX_ATTEMPTS
//                            attempts exist, the claim is released
//                            (conditionally) so a later run retries. Otherwise
//                            the claim stays and the reminder is abandoned.
//   Any error after a successful claim (DB error, logging failure, failed
//   release, exception) leaves the claim in place: a reminder may be lost, but
//   an email is never sent twice. Resend also receives a per-booking/type
//   Idempotency-Key as a second guard against ambiguous (sent-but-errored)
//   responses.
//
// PRIVACY
//   Emails go only to the property's host and contain no guest data. Logs carry
//   booking ids, reminder types, HTTP statuses, safe categories and counts —
//   never email addresses or provider response bodies. Responses are counts only.

import { buildReminderEmailHtml, escapeHtml, safeRecord, subjectSafe } from './templates.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

export type ReminderType = '12h' | '16h';

export interface HandlerDeps {
  /** Service-role Supabase client. */
  db: Db;
  /** CRON_SECRET. Empty → every request is denied. */
  cronSecret: string | undefined;
  /**
   * Sends one email via Resend. Must not throw. `body` is used only to classify
   * permanent failures and is never logged or stored.
   */
  sendResend: (msg: { from: string; to: string; subject: string; html: string; idempotencyKey: string }) => Promise<{ status: number; body: string }>;
  now?: () => Date;
  /** Structured log sink: ids, types, statuses, categories and counts only. */
  log?: (event: string, fields?: Record<string, string | number | boolean | null>) => void;
}

export const FROM_EMAIL = 'bookings@rentcottage.ge';
export const MAX_ATTEMPTS = 3;
export const CONTEXT: Record<ReminderType, string> = { '12h': 'host_reminder_12h', '16h': 'host_reminder_16h' };

const HOUR_MS = 60 * 60 * 1000;
const PENDING = 'pending_host_approval';
const PERMANENT_BOUNCE_CODES = ['email_not_deliverable', 'invalid_email', 'mailbox_does_not_exist', 'invalid_to'];

export interface RunCounts {
  checked: number;
  reminder12Sent: number;
  reminder16Sent: number;
  skipped: number;
  blocked: number;
  retriesScheduled: number;
  errors: number;
}

function json(body: Row, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Constant-time secret comparison (both sides hashed so length does not leak). */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Which reminder (if any) a booking is due for at `now`, from its approval deadline. */
export function dueReminder(booking: Row, now: Date): ReminderType | null {
  if (booking.status !== PENDING) return null;
  const deadline = Date.parse(String(booking.approval_deadline ?? ''));
  if (!Number.isFinite(deadline)) return null;
  const remaining = deadline - now.getTime();
  if (remaining <= 0) return null;
  if (remaining <= 8 * HOUR_MS) return booking.reminder_16h_sent === true ? null : '16h';
  if (remaining <= 12 * HOUR_MS) return booking.reminder_12h_sent === true || booking.reminder_16h_sent === true ? null : '12h';
  return null;
}

type Outcome = 'sent' | 'permanent' | 'transient';

function classify(status: number, body: string): Outcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 422) return 'permanent';
  if (status === 400) {
    const l = (body ?? '').toLowerCase();
    if (PERMANENT_BOUNCE_CODES.some((c) => l.includes(c)) || (l.includes('invalid') && l.includes('email'))) return 'permanent';
  }
  return 'transient';
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const db = deps.db;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  async function authorized(req: Request): Promise<boolean> {
    const expected = deps.cronSecret ?? '';
    if (!expected) {
      log('config_error', { missing: 'CRON_SECRET' });
      return false;
    }
    return secretsMatch(req.headers.get('x-cron-secret') ?? '', expected);
  }

  /** Delivery-log rows for one booking + reminder type, by status. Throws on DB error. */
  async function attemptCounts(bookingId: string, type: ReminderType): Promise<{ transient: number; sent: number }> {
    const { data, error } = await db.from('email_delivery_logs').select('status').eq('context', CONTEXT[type]).eq('context_id', bookingId);
    if (error) throw new Error('delivery_log_read_failed');
    const rows = (data ?? []) as Row[];
    return {
      transient: rows.filter((r) => r.status === 'transient_failure').length,
      sent: rows.filter((r) => r.status === 'sent').length,
    };
  }

  async function writeDeliveryLog(to: string, subject: string, bookingId: string, type: ReminderType, status: string, httpStatus: number | null, category: string | null, attempt: number): Promise<boolean> {
    try {
      // email_delivery_logs is service-role only; the recipient is required there
      // for bounce handling. error_message holds a safe category, never a body.
      const { error } = await db.from('email_delivery_logs').insert({
        recipient_email: to.toLowerCase().trim(),
        subject,
        context: CONTEXT[type],
        context_id: bookingId,
        status,
        http_status: httpStatus,
        error_message: category,
        attempt_number: attempt,
        retry_after: null,
        updated_at: now().toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  }

  async function claim(bookingId: string, type: ReminderType): Promise<boolean> {
    const nowIso = now().toISOString();
    let q = db.from('bookings')
      .update(type === '16h' ? { reminder_16h_sent: true, reminder_12h_sent: true } : { reminder_12h_sent: true })
      .eq('id', bookingId)
      .eq('status', PENDING)
      .gt('approval_deadline', nowIso);
    q = type === '16h' ? q.eq('reminder_16h_sent', false) : q.eq('reminder_12h_sent', false).eq('reminder_16h_sent', false);
    const { data, error } = await q.select('id');
    if (error) throw new Error('claim_failed');
    return Array.isArray(data) && data.length === 1;
  }

  /** Undo a claim so a later run may retry. The 12h flag set by a 16h claim is kept. */
  async function release(bookingId: string, type: ReminderType): Promise<boolean> {
    try {
      let q = db.from('bookings')
        .update(type === '16h' ? { reminder_16h_sent: false } : { reminder_12h_sent: false })
        .eq('id', bookingId)
        .eq('status', PENDING);
      q = type === '16h' ? q.eq('reminder_16h_sent', true) : q.eq('reminder_12h_sent', true).eq('reminder_16h_sent', false);
      const { data, error } = await q.select('id');
      return !error && Array.isArray(data) && data.length === 1;
    } catch {
      return false;
    }
  }

  async function processBooking(booking: Row, counts: RunCounts): Promise<void> {
    const id = String(booking.id);
    const type = dueReminder(booking, now());
    if (!type) { counts.skipped++; return; }
    if (!booking.property_id) { counts.skipped++; return; }

    const { data: prop, error: propErr } = await db.from('property_applications').select('host_email, host_first_name').eq('id', String(booking.property_id)).maybeSingle();
    if (propErr) { counts.errors++; log('property_lookup_failed', { bookingId: id }); return; }
    const hostEmail = typeof prop?.host_email === 'string' ? prop.host_email.trim() : '';
    if (!hostEmail) { counts.skipped++; return; }

    // Blocked recipients: read-only skip, no claim and no log row, so repeated
    // runs never accumulate writes.
    const { data: blocked, error: blockedErr } = await db.from('blocked_emails').select('id').eq('email', hostEmail.toLowerCase()).maybeSingle();
    if (blockedErr) { counts.errors++; log('blocked_lookup_failed', { bookingId: id }); return; }
    if (blocked) { counts.blocked++; return; }

    // Cheap pre-check (authoritative re-check happens under the claim).
    const pre = await attemptCounts(id, type);
    if (pre.sent > 0 || pre.transient >= MAX_ATTEMPTS) { counts.skipped++; return; }

    if (!(await claim(id, type))) { counts.skipped++; return; }

    // ── From here on the claim is held. Every early exit keeps it. ──
    let prior: { transient: number; sent: number };
    try {
      prior = await attemptCounts(id, type);
    } catch {
      counts.errors++;
      log('reminder_abandoned', { bookingId: id, type, reason: 'delivery_log_read_failed' });
      return;
    }
    if (prior.sent > 0 || prior.transient >= MAX_ATTEMPTS) {
      counts.skipped++;
      log('reminder_abandoned', { bookingId: id, type, reason: prior.sent > 0 ? 'already_sent' : 'max_attempts' });
      return;
    }
    const attempt = prior.transient + 1;

    const deadline = Date.parse(String(booking.approval_deadline));
    const hoursElapsed = Math.floor((now().getTime() - (deadline - 24 * HOUR_MS)) / HOUR_MS);
    const title = String(booking.property_title ?? '');
    const subject = subjectSafe(type === '16h'
      ? `⚠️ გადაუდებელი: ჯავშნის მოთხოვნა ვადის ამოწურვის პირასაა – ${title}`
      : `⏰ შეხსენება: გაქვთ განუხილველი ჯავშნის მოთხოვნა – ${title}`);
    const html = buildReminderEmailHtml(
      escapeHtml(prop?.host_first_name || 'ჰოსტო'),
      safeRecord({ id, property_title: title, check_in: booking.check_in, check_out: booking.check_out, guests: booking.guests, total_price: booking.total_price }),
      type === '16h' ? 2 : 1,
      hoursElapsed,
    );

    let status = 0;
    let body = '';
    try {
      const res = await deps.sendResend({ from: FROM_EMAIL, to: hostEmail, subject, html, idempotencyKey: `booking-reminder-${type}-${id}` });
      status = res.status;
      body = res.body ?? '';
    } catch {
      status = 0;
    }
    const outcome = classify(status, body);

    if (outcome === 'sent') {
      await writeDeliveryLog(hostEmail, subject, id, type, 'sent', status, null, attempt);
      if (type === '16h') counts.reminder16Sent++; else counts.reminder12Sent++;
      log('reminder_sent', { bookingId: id, type, attempt });
      return;
    }

    counts.errors++;
    const category = status === 0 ? 'network_error' : `http_${status}`;

    if (outcome === 'permanent') {
      try {
        await db.from('blocked_emails').upsert({
          email: hostEmail.toLowerCase(),
          blocked_reason: `Permanent bounce (HTTP ${status})`,
          blocked_at: now().toISOString(),
          source: `${CONTEXT[type]}/${id}`,
          bounce_type: 'permanent',
        }, { onConflict: 'email' });
      } catch { /* claim stays either way */ }
      await writeDeliveryLog(hostEmail, subject, id, type, 'permanent_failure', status, category, attempt);
      log('reminder_failed', { bookingId: id, type, category, permanent: true });
      return;
    }

    // Transient: the attempt must be recorded before the claim may be released,
    // otherwise the attempt cap could not be enforced.
    const logged = await writeDeliveryLog(hostEmail, subject, id, type, 'transient_failure', status || null, category, attempt);
    if (!logged || attempt >= MAX_ATTEMPTS) {
      log('reminder_failed', { bookingId: id, type, category, attempt, retry: false });
      return;
    }
    if (await release(id, type)) {
      counts.retriesScheduled++;
      log('reminder_failed', { bookingId: id, type, category, attempt, retry: true });
    } else {
      log('reminder_failed', { bookingId: id, type, category, attempt, retry: false });
    }
  }

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!(await authorized(req))) return json({ error: 'Unauthorized' }, 401);

    const counts: RunCounts = { checked: 0, reminder12Sent: 0, reminder16Sent: 0, skipped: 0, blocked: 0, retriesScheduled: 0, errors: 0 };
    const nowDate = now();
    const { data: bookings, error } = await db.from('bookings')
      .select('id, property_id, property_title, check_in, check_out, guests, total_price, status, approval_deadline, reminder_12h_sent, reminder_16h_sent')
      .eq('status', PENDING)
      .gt('approval_deadline', nowDate.toISOString())
      .lte('approval_deadline', new Date(nowDate.getTime() + 12 * HOUR_MS).toISOString());
    if (error) {
      log('discovery_failed');
      return json({ error: 'Request failed' }, 500);
    }

    for (const booking of (bookings ?? []) as Row[]) {
      counts.checked++;
      try {
        await processBooking(booking, counts);
      } catch {
        counts.errors++;
        log('reminder_error', { bookingId: String(booking.id) });
      }
    }

    log('run_complete', { ...counts });
    return json({ success: true, ...counts });
  };
}
