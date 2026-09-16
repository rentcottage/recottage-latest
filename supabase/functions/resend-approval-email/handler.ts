// Request handling for resend-approval-email, kept free of Deno globals and
// network imports so the security behaviour can be unit-tested (handler.test.ts).
// index.ts wires in the real Supabase lookup and Resend sender.
//
// SECURITY
// - Admin-only. Uses the project's existing admin mechanism: the
//   ADMIN_PANEL_PASSWORD secret, presented by the admin panel in the
//   `x-admin-password` header (same gate as admin-host-actions,
//   admin-user-management, host-broadcast). Anything else → 401.
// - The recipient is always the host_email stored on the application. Nothing
//   in the request can choose or influence who receives the email.
// - Responses never contain the host's email, name, database errors or
//   provider (Resend) error bodies.
// - Logs contain only the application id and HTTP status codes.

export const COMPANY_EMAIL = 'info.rentcottage@gmail.com';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export interface ApprovalApplication {
  id: string;
  status: string | null;
  title: string | null;
  location: string | null;
  price_per_night: number | string | null;
  host_first_name: string | null;
  host_last_name: string | null;
  host_email: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface HandlerDeps {
  /** Server-side ADMIN_PANEL_PASSWORD. Empty/undefined means the function is misconfigured and denies everything. */
  adminPassword: string | undefined;
  /** Loads one application by id, or null when it does not exist. Throws on database errors. */
  loadApplication: (id: string) => Promise<ApprovalApplication | null>;
  /** Sends the email. Resolves ok:false (with an HTTP status, never a body) on provider failure. */
  sendEmail: (message: EmailMessage) => Promise<{ ok: boolean; status?: number }>;
  /** Structured log sink. Must never receive emails, names, passwords or tokens. */
  log?: (event: string, fields: Record<string, string | number>) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** HTML-escapes host-controlled text before it is placed in the email body. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Single-line, length-capped text for the Subject header (no CR/LF or other control characters). */
export function headerSafe(value: unknown, max = 120): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Constant-time comparison. Both inputs are hashed first so neither the
 * content nor the length of the real password leaks through timing.
 */
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

export function buildApprovalEmailHtml(app: ApprovalApplication): string {
  const hostName = escapeHtml(`${app.host_first_name ?? ''} ${app.host_last_name ?? ''}`.trim());
  const price = Number(app.price_per_night);
  const priceText = Number.isFinite(price) ? escapeHtml(price) : '—';
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
      <div style="background:#e53e3e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">RentCottage.Ge</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
        <h2 style="color:#38a169;margin-top:0">Congratulations! Your cottage is approved &#x1f389;</h2>
        <p>Hi ${hostName},</p>
        <p>Great news! Your cottage application has been <strong>approved</strong> by our team. Your listing is now <strong>live</strong> on RentCottage.Ge and visible to guests.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
          <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;width:40%">Cottage</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${escapeHtml(app.title)}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Location</td><td style="padding:10px 14px;border:1px solid #e5e7eb">${escapeHtml(app.location)}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Price per night</td><td style="padding:10px 14px;border:1px solid #e5e7eb">&#x20BE;${priceText}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb">Status</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#38a169;font-weight:600">&#x2705; Approved &amp; Live</td></tr>
        </table>
        <p>Guests can now discover and book your cottage. You will be notified for every booking request.</p>
        <p style="color:#555;font-size:14px">For any questions, contact us at <a href="mailto:${COMPANY_EMAIL}" style="color:#e53e3e">${COMPANY_EMAIL}</a>.</p>
        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px">&#xa9; 2024 RentCottage.Ge</p>
      </div>
    </div>`;
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const log = deps.log ?? (() => {});

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // The admin panel only POSTs. The old unauthenticated GET ?applicationId=
    // fallback is gone.
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // ── Admin authorization — before reading the body or touching the DB ──
    const expected = deps.adminPassword ?? '';
    if (!expected) {
      log('config_error', { reason: 'admin_password_not_configured' });
      return json({ error: 'Unauthorized' }, 401);
    }
    const provided = req.headers.get('x-admin-password') ?? '';
    if (!(await secretsMatch(provided, expected))) {
      log('unauthorized', { status: 401 });
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // Only applicationId is read. Any recipient/email/name fields a caller adds
    // are ignored — the recipient comes from the database.
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : '';
    if (!applicationId) {
      return json({ error: 'applicationId is required' }, 400);
    }
    if (!UUID_RE.test(applicationId)) {
      return json({ error: 'Invalid applicationId' }, 400);
    }

    let app: ApprovalApplication | null;
    try {
      app = await deps.loadApplication(applicationId);
    } catch {
      log('load_failed', { applicationId });
      return json({ error: 'Failed to load application' }, 500);
    }

    if (!app) {
      return json({ error: 'Application not found' }, 404);
    }

    // The button only exists for approved listings; an "approved" email for a
    // pending or rejected application would be false.
    if (app.status !== 'approved') {
      return json({ error: 'Application is not approved' }, 409);
    }

    const to = typeof app.host_email === 'string' ? app.host_email.trim() : '';
    if (!to) {
      log('missing_recipient', { applicationId });
      return json({ error: 'Application has no contact email' }, 422);
    }

    const result = await deps.sendEmail({
      to,
      subject: `Your cottage "${headerSafe(app.title)}" has been approved!`,
      html: buildApprovalEmailHtml(app),
    });

    if (!result.ok) {
      log('send_failed', { applicationId, status: result.status ?? 0 });
      return json({ error: 'Failed to send email' }, 502);
    }

    log('sent', { applicationId });
    return json({ success: true });
  };
}
