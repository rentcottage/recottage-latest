// admin-read — read-only data for the admin dashboard, which has no Supabase
// session (it holds ADMIN_PANEL_PASSWORD in sessionStorage). Kept free of Deno
// globals and network imports so it can be unit-tested (handler.test.ts);
// index.ts wires in the service-role Supabase client.
//
// SECURITY
// - Every request must carry `x-admin-password` (header only — a password in
//   the body is ignored). It is compared with the ADMIN_PANEL_PASSWORD secret
//   by SHA-256 + constant-time comparison; an unset secret denies everything.
//   Failures get the same generic 401 and never reach the data actions, and
//   ten failures from one client in fifteen minutes turn into 429s — the same
//   throttle admin-host-actions uses (_shared/adminAuth.ts).
// - The password (and the header) is never logged or echoed.
// - Read-only: every action is a SELECT with explicit columns and bounds.
//   Database errors are reported as a generic 500.
// - CORS echoes only the production site and local development origins.
//
// Adding an action: write a function (body, db) → Promise<Response> that
// validates its own input, and register it in ACTIONS.

import { authorizeAdmin } from '../_shared/adminAuth.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export interface AdminReadDeps {
  /** Service-role Supabase client. */
  db: Db;
  /** Server-side ADMIN_PANEL_PASSWORD. Empty/undefined denies every request. */
  adminPassword: string | undefined;
  /** Diagnostics: action names and counts only. */
  log?: (event: string, fields?: Record<string, string | number | boolean>) => void;
}

const ALLOWED_ORIGIN_RE = /^(https:\/\/(www\.)?rentcottage\.ge|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/;

export const PAYMENT_LOGS_MAX = 200;

/** Fields BookingHistoryPanel renders. */
export const BOOKING_HISTORY_COLUMNS = 'id, event_type, from_status, to_status, changed_by, note, created_at';

/** Fields PaymentLogsPanel renders, including the booking it belongs to. */
export const PAYMENT_LOG_COLUMNS =
  'id, booking_id, event_type, from_status, to_status, changed_by, note, created_at, ' +
  'booking:bookings(user_email, user_name, property_title, total_price, payment_status, payment_method)';

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGIN_RE.test(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export { passwordMatches } from '../_shared/adminAuth.ts';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type Action = (body: Row, db: Db) => Promise<Row>;

const bookingHistory: Action = async (body, db) => {
  const bookingId = typeof body.booking_id === 'string' ? body.booking_id.trim() : '';
  if (!UUID_RE.test(bookingId)) throw new HttpError(400, 'Invalid booking_id');
  const { data, error } = await db.from('booking_status_logs')
    .select(BOOKING_HISTORY_COLUMNS)
    .eq('booking_id', bookingId.toLowerCase())
    .order('created_at', { ascending: true });
  if (error) throw new HttpError(500, 'Request failed');
  return { logs: data ?? [] };
};

const paymentLogs: Action = async (body, db) => {
  let limit = PAYMENT_LOGS_MAX;
  if (body.limit !== undefined) {
    if (typeof body.limit !== 'number' || !Number.isInteger(body.limit) || body.limit < 1 || body.limit > PAYMENT_LOGS_MAX) {
      throw new HttpError(400, 'Invalid limit');
    }
    limit = body.limit;
  }
  let before: string | null = null;
  if (body.before !== undefined && body.before !== null) {
    if (typeof body.before !== 'string' || !ISO_TS_RE.test(body.before) || Number.isNaN(Date.parse(body.before))) {
      throw new HttpError(400, 'Invalid before');
    }
    before = body.before;
  }
  let query = db.from('booking_status_logs').select(PAYMENT_LOG_COLUMNS);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw new HttpError(500, 'Request failed');
  return { logs: data ?? [] };
};

export const ACTIONS: Record<string, Action> = {
  'booking-history': bookingHistory,
  'payment-logs': paymentLogs,
};

export function createHandler(deps: AdminReadDeps): (req: Request) => Promise<Response> {
  const log = deps.log ?? (() => {});

  return async (req: Request): Promise<Response> => {
    const cors = corsFor(req);
    const json = (body: Row, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = await authorizeAdmin(req, {
      db: deps.db,
      adminPassword: deps.adminPassword,
      functionName: 'admin-read',
    });
    if (!auth.ok) {
      log(auth.status === 429 ? 'throttled' : 'unauthorized');
      return json({ error: auth.status === 429 ? 'Too many attempts' : 'Unauthorized' }, auth.status);
    }

    let body: Row;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Row;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const action = typeof body.action === 'string' ? body.action : '';
    const run = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!run) return json({ error: 'Unsupported action' }, 400);

    try {
      const result = await run(body, deps.db);
      log('ok', { action, rows: Array.isArray(result.logs) ? result.logs.length : 0 });
      return json(result);
    } catch (e) {
      if (e instanceof HttpError) {
        log('rejected', { action, status: e.status });
        return json({ error: e.message }, e.status);
      }
      log('failed', { action });
      return json({ error: 'Request failed' }, 500);
    }
  };
}
