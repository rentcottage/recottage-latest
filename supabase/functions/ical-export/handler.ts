// ical-export — public availability feed for OTAs (Airbnb, Booking.com).
// Free of Deno globals and network imports so it can be unit-tested
// (handler.test.ts); index.ts wires in the service-role Supabase client.
//
// SECURITY MODEL
//   • Deployed with verify_jwt = false: OTAs cannot send Authorization headers.
//   • The only credential is an unguessable per-property token in the path:
//       GET /ical-export/<token>.ics   (token = 32 random bytes, base64url, 43 chars)
//     created/rotated by the owning host through ical-sync `export-token`.
//   • The token format is checked before any database access; malformed,
//     unknown, rotated and ineligible tokens all get the identical 404.
//   • No property id or title goes in or out. Events carry fixed summaries and
//     hashed UIDs only. Imported OTA blocks (ical_blocked_dates) are never
//     exported, so an OTA never receives its own blocks back.
//
// DATE SEMANTICS (verified against booking code and data)
//   bookings.check_out is the departure date (not a night) → DTEND = check_out.
//   blocked_dates.end_date is the last blocked day (inclusive) → DTEND = end_date + 1.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export interface ExportDeps {
  /** Service-role Supabase client. */
  db: Db;
  now?: () => Date;
  /** Server-side diagnostics: categories only, never the token. */
  log?: (event: string, fields?: Record<string, string | number | boolean | null>) => void;
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Same statuses the booking handler treats as occupying a property's nights. */
export const EXPORTED_BOOKING_STATUSES = ['confirmed', 'pending', 'pending_host_approval'];

/** Every existing property exports except rejected ones (deleted rows cascade the token away). */
export function isEligibleProperty(p: Row | null | undefined): boolean {
  return Boolean(p) && String(p?.status ?? '') !== 'rejected';
}

/** Extracts the token from `/…/ical-export/<token>.ics`; null unless it has the exact format. */
export function tokenFromPath(pathname: string): string | null {
  const m = /\/ical-export\/([^/]*)\.ics$/.exec(pathname);
  if (!m || !TOKEN_RE.test(m[1])) return null;
  return m[1];
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function uidFor(kind: string, id: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rentcottage-export:${kind}:${String(id)}`));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 32)}@rentcottage.ge`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function icsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ExportEvent { uid: string; start: string; end: string; summary: string }

/** Builds the feed. start/end are ISO dates; end is exclusive (iCalendar DATE semantics). */
export function buildCalendar(events: ExportEvent[], stamp: Date): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RentCottage.Ge//Availability//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:RentCottage.Ge availability',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
      `DTEND;VALUE=DATE:${icsDate(e.end)}`,
      `SUMMARY:${e.summary}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

const NOT_FOUND_BODY = 'Not found';

export function createExportHandler(deps: ExportDeps): (req: Request) => Promise<Response> {
  const db = deps.db;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  const notFound = () => new Response(NOT_FOUND_BODY, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  const failed = () => new Response('Temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '300' } });

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    let pathname = '';
    try { pathname = new URL(req.url).pathname; } catch { return notFound(); }
    const token = tokenFromPath(pathname);
    if (!token) return notFound();                       // format check before any DB access

    try {
      const { data: row, error: tokErr } = await db.from('ical_export_tokens').select('property_id, token').eq('token', token).maybeSingle();
      if (tokErr) { log('export_failed', { stage: 'token' }); return failed(); }
      if (!row || typeof row.token !== 'string' || !constantTimeEqual(row.token, token)) return notFound();

      const propertyId = String(row.property_id);
      const { data: property, error: propErr } = await db.from('property_applications').select('id, status').eq('id', propertyId).maybeSingle();
      if (propErr) { log('export_failed', { stage: 'property' }); return failed(); }
      if (!isEligibleProperty(property)) return notFound();

      const today = now().toISOString().slice(0, 10);
      const [bookingsRes, blocksRes] = await Promise.all([
        db.from('bookings').select('id, check_in, check_out')
          .eq('property_id', propertyId)
          .in('status', EXPORTED_BOOKING_STATUSES)
          .gt('check_out', today)                          // departure today → no night left to block
          .order('check_in', { ascending: true }),
        db.from('blocked_dates').select('id, start_date, end_date')
          .eq('property_id', propertyId)
          .gte('end_date', today)
          .order('start_date', { ascending: true }),
      ]);
      if (bookingsRes.error || blocksRes.error) { log('export_failed', { stage: 'events' }); return failed(); }

      const events: ExportEvent[] = [];
      for (const b of (bookingsRes.data ?? []) as Row[]) {
        const start = String(b.check_in ?? ''); const end = String(b.check_out ?? '');
        if (!DATE_RE.test(start) || !DATE_RE.test(end) || end <= start || end <= today) continue;
        events.push({ uid: await uidFor('booking', b.id), start, end, summary: 'Reserved' });
      }
      for (const d of (blocksRes.data ?? []) as Row[]) {
        const start = String(d.start_date ?? ''); const last = String(d.end_date ?? '');
        if (!DATE_RE.test(start) || !DATE_RE.test(last) || last < start || last < today) continue;
        events.push({ uid: await uidFor('block', d.id), start, end: addDays(last, 1), summary: 'Not available' });
      }

      log('export_served', { events: events.length });
      const body = buildCalendar(events, now());
      return new Response(req.method === 'HEAD' ? null : body, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'inline; filename="rentcottage-availability.ics"',
          'Cache-Control': 'max-age=300',
        },
      });
    } catch {
      log('export_failed', { stage: 'unexpected' });
      return failed();
    }
  };
}
