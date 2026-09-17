// ical-sync — external calendar import (Airbnb/Booking.com iCal) and export.
// Free of Deno globals and network imports so the security boundary can be
// unit-tested (handler.test.ts); index.ts wires in Supabase, auth.getUser,
// Deno.resolveDns and Deno.connect/startTls.
//
// SECURITY MODEL
//   POST actions (add-calendar, remove-calendar, sync-calendar, sync-all)
//     • require `Authorization: Bearer <user access token>`, verified with
//       auth.getUser(); the anon key, service keys and invalid tokens → 401.
//     • identity = verified user email (confirmed); body host_email is ignored.
//     • property ownership = property_applications.host_email (server-side)
//       equals the verified email; calendars are owned through their property.
//     • remove-calendar verifies ownership before deleting anything.
//   Legacy save-url / import / refresh and unknown actions → 400.
//   GET export: unchanged (gateway JWT verification still applies).
//
// SSRF BOUNDARY (safeFetchCalendar)
//   https only, default port, no credentials, no localhost/internal names;
//   every A/AAAA record must be public; the TCP connection goes to that vetted
//   address with TLS verified for the original hostname (no re-resolution, so
//   DNS rebinding cannot redirect it); redirects are never followed; hard
//   timeout and byte cap. Clients only ever see generic errors.

// ─── iCal parser ────────────────────────────────────────────────────────────
export function parseICS(text: string): Array<{ uid: string; summary: string; start: string; end: string }> {
  const events: Array<{ uid: string; summary: string; start: string; end: string }> = [];
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let uid = "";
  let summary = "";
  let dtstart = "";
  let dtend = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      uid = "";
      summary = "";
      dtstart = "";
      dtend = "";
    } else if (line === "END:VEVENT") {
      if (inEvent && dtstart && dtend) {
        events.push({
          uid,
          summary,
          start: parseICalDate(dtstart),
          end: parseICalDate(dtend),
        });
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith("UID:")) uid = line.slice(4);
      else if (line.startsWith("SUMMARY:")) summary = line.slice(8);
      else if (line.startsWith("DTSTART")) {
        const val = line.includes(":") ? line.split(":").slice(1).join(":") : "";
        dtstart = val;
      } else if (line.startsWith("DTEND")) {
        const val = line.includes(":") ? line.split(":").slice(1).join(":") : "";
        dtend = val;
      }
    }
  }
  return events;
}

export function parseICalDate(icalDate: string): string {
  if (/^\d{8}$/.test(icalDate)) {
    return `${icalDate.slice(0, 4)}-${icalDate.slice(4, 6)}-${icalDate.slice(6, 8)}`;
  }
  const match = icalDate.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return icalDate;
}


// ─── iCal generator (export from our website) ────────────────────────────────
export function generateICS(
  propertyTitle: string,
  bookings: Array<{ check_in: string; check_out: string; id: string }>,
  blockedDates: Array<{ start_date: string; end_date: string; id: string; platform: string }>
): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RentCottage.Ge//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${propertyTitle} - RentCottage.Ge`,
    "X-WR-TIMEZONE:Asia/Tbilisi",
  ];

  for (const b of bookings) {
    const startDate = b.check_in.replace(/-/g, "");
    const endD = new Date(b.check_out + "T00:00:00");
    endD.setDate(endD.getDate() + 1);
    const endDate = endD.toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:rentcottage-booking-${b.id}@rentcottage.ge`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      "SUMMARY:Reserved - RentCottage.Ge",
      "END:VEVENT"
    );
  }

  // Also include manually blocked dates in export
  for (const bd of blockedDates) {
    const startDate = bd.start_date.replace(/-/g, "");
    const endD = new Date(bd.end_date + "T00:00:00");
    endD.setDate(endD.getDate() + 1);
    const endDate = endD.toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:rentcottage-block-${bd.id}@rentcottage.ge`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      "SUMMARY:Not available - RentCottage.Ge",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Safe calendar fetching (SSRF boundary)
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimal byte stream over a TLS connection (Deno.TlsConn in production, fake in tests). */
export interface Transport {
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  close(): void;
}

export type FetchFailure =
  | 'invalid_url' | 'blocked_host' | 'dns_failed' | 'blocked_address' | 'connect_failed'
  | 'timeout' | 'redirect' | 'http_error' | 'too_large' | 'bad_response';

export type FetchResult = { ok: true; text: string } | { ok: false; reason: FetchFailure };

function ipv4Octets(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}

/** true only for globally routable unicast IPv4. */
export function isPublicIPv4(ip: string): boolean {
  const o = ipv4Octets(ip);
  if (!o) return false;
  const [a, b, c] = o;
  if (a === 0 || a === 10 || a === 127) return false;                 // this-net, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false;                  // CGNAT 100.64/10
  if (a === 169 && b === 254) return false;                            // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;                   // private 172.16/12
  if (a === 192 && b === 168) return false;                            // private 192.168/16
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;      // IETF 192.0.0/24, TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false;                 // 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return false;               // benchmarking 198.18/15
  if (a === 198 && b === 51 && c === 100) return false;                // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false;                 // TEST-NET-3
  if (a >= 224) return false;                                          // multicast 224/4, reserved 240/4, broadcast
  return true;
}

function ipv6Groups(s: string): number[] | null {
  let addr = s.toLowerCase();
  if (addr.includes('%')) return null;                                 // zone ids are never public
  let tail: number[] = [];
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(addr);
  if (v4) {
    const o = ipv4Octets(v4[1]);
    if (!o) return null;
    tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
    addr = addr.slice(0, -v4[1].length);
    if (addr.endsWith(':') && !addr.endsWith('::')) addr = addr.slice(0, -1);
  }
  const parts = addr.split('::');
  if (parts.length > 2) return null;
  const parse = (x: string) => (x === '' ? [] : x.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)));
  const head = parse(parts[0]);
  const rest = parts.length === 2 ? parse(parts[1]) : [];
  const want = 8 - tail.length;
  let groups: number[];
  if (parts.length === 2) {
    const fill = want - head.length - rest.length;
    if (fill < 0) return null;
    groups = [...head, ...new Array(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  groups = [...groups, ...tail];
  if (groups.length !== 8 || groups.some((g) => !Number.isFinite(g))) return null;
  return groups;
}

/** true only for global unicast IPv6 outside special-purpose ranges. */
export function isPublicIPv6(ip: string): boolean {
  const g = ipv6Groups(ip.replace(/^\[|\]$/g, ''));
  if (!g) return false;
  if (g.every((x) => x === 0)) return false;                                            // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false;                   // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {                           // ::ffff:a.b.c.d
    return isPublicIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if (g.slice(0, 6).every((x) => x === 0)) return false;                                  // deprecated IPv4-compatible
  if (g[0] === 0x64 && g[1] === 0xff9b) return false;                                     // NAT64 64:ff9b::/96 and /48
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return false;             // discard 100::/64
  if (g[0] === 0x2001 && g[1] < 0x200) return false;                                      // 2001::/23 IETF (Teredo, ORCHID…)
  if (g[0] === 0x2001 && g[1] === 0xdb8) return false;                                    // documentation
  if (g[0] === 0x2002) return false;                                                      // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return false;                                           // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return false;                                           // link-local fe80::/10
  if ((g[0] & 0xffc0) === 0xfec0) return false;                                           // site-local fec0::/10
  if ((g[0] & 0xff00) === 0xff00) return false;                                           // multicast ff00::/8
  if ((g[0] & 0xe000) !== 0x2000) return false;                                           // only 2000::/3 is global unicast
  return true;
}

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.home.arpa', '.localdomain', '.arpa'];

export type UrlCheck = { ok: true; url: URL; host: string; port: number; literalIp: string | null } | { ok: false; reason: FetchFailure };

/**
 * Static URL policy (no network): https only, default port, no credentials,
 * no localhost/internal names, literal IPs must be public.
 */
export function checkCalendarUrl(raw: unknown): UrlCheck {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > 2048) return { ok: false, reason: 'invalid_url' };
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false, reason: 'invalid_url' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'invalid_url' };
  if (u.username || u.password) return { ok: false, reason: 'invalid_url' };
  if (u.port !== '' && u.port !== '443') return { ok: false, reason: 'blocked_host' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, reason: 'invalid_url' };
  if (host.startsWith('[')) {
    const ip = host.slice(1, -1);
    return isPublicIPv6(ip) ? { ok: true, url: u, host: ip, port: 443, literalIp: ip } : { ok: false, reason: 'blocked_address' };
  }
  if (ipv4Octets(host)) {
    return isPublicIPv4(host) ? { ok: true, url: u, host, port: 443, literalIp: host } : { ok: false, reason: 'blocked_address' };
  }
  // Numeric forms the URL parser did not normalise (e.g. "2130706433") are refused.
  if (/^[0-9.]+$/.test(host) || /^0x/i.test(host)) return { ok: false, reason: 'blocked_host' };
  if (host === 'localhost' || !host.includes('.') || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'blocked_host' };
  }
  return { ok: true, url: u, host, port: 443, literalIp: null };
}

export interface NetDeps {
  /** Deno.resolveDns(host, type): resolved addresses; throws/[] when none. */
  resolveDns: (host: string, type: 'A' | 'AAAA') => Promise<string[]>;
  /** TCP connect to `ip`, then TLS with certificate verification + SNI for `serverName`. */
  openTls: (ip: string, port: number, serverName: string) => Promise<Transport>;
  timeoutMs?: number;
  maxBytes?: number;
}

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_HEADER_BYTES = 32 * 1024;

/**
 * Resolves the host and returns ONE vetted address. Every A/AAAA record must be
 * public; a single private/reserved record rejects the host (defeats split
 * answers). The returned address is the one we connect to, so a later DNS
 * change (rebinding) cannot redirect the connection.
 */
export async function resolvePublicAddress(check: Extract<UrlCheck, { ok: true }>, deps: NetDeps): Promise<{ ok: true; ip: string } | { ok: false; reason: FetchFailure }> {
  if (check.literalIp) return { ok: true, ip: check.literalIp };
  const lookup = async (type: 'A' | 'AAAA') => { try { return await deps.resolveDns(check.host, type); } catch { return []; } };
  const [v4, v6] = await Promise.all([lookup('A'), lookup('AAAA')]);
  const all = [...v4, ...v6];
  if (all.length === 0) return { ok: false, reason: 'dns_failed' };
  if (v4.some((ip) => !isPublicIPv4(ip)) || v6.some((ip) => !isPublicIPv6(ip))) return { ok: false, reason: 'blocked_address' };
  return { ok: true, ip: v4[0] ?? v6[0] };
}

function indexOfCRLFCRLF(buf: Uint8Array): number {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function decodeChunked(body: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [];
  let total = 0;
  let i = 0;
  while (i < body.length) {
    let j = i;
    while (j + 1 < body.length && !(body[j] === 13 && body[j + 1] === 10)) j++;
    if (j + 1 >= body.length) return null;
    const sizeLine = new TextDecoder().decode(body.subarray(i, j)).split(';')[0].trim();
    if (!/^[0-9a-f]+$/i.test(sizeLine)) return null;
    const size = parseInt(sizeLine, 16);
    i = j + 2;
    if (size === 0) return concat(out, total);
    if (i + size + 2 > body.length) return null;
    out.push(body.subarray(i, i + size));
    total += size;
    i += size + 2;
  }
  return null;
}

/**
 * Fetches an iCal URL without following redirects, pinned to a vetted public
 * address, with a hard deadline and a byte cap on the whole response.
 */
export async function safeFetchCalendar(raw: string, deps: NetDeps): Promise<FetchResult> {
  const check = checkCalendarUrl(raw);
  if (!check.ok) return check;
  const addr = await resolvePublicAddress(check, deps);
  if (!addr.ok) return addr;

  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  let transport: Transport | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const work = (async (): Promise<FetchResult> => {
    try {
      transport = await deps.openTls(addr.ip, check.port, check.host);
    } catch {
      return { ok: false, reason: 'connect_failed' };
    }
    const path = (check.url.pathname || '/') + check.url.search;
    const req = new TextEncoder().encode(
      `GET ${path} HTTP/1.1\r\nHost: ${check.host}\r\nUser-Agent: RentCottage-iCal-Sync/2.0\r\n` +
      `Accept: text/calendar, text/plain;q=0.9, */*;q=0.1\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`,
    );
    for (let off = 0; off < req.length;) off += await transport.write(req.subarray(off));

    const chunks: Uint8Array[] = [];
    let total = 0;
    let headerEnd = -1;
    let status = 0;
    let headers: Record<string, string> = {};
    const buf = new Uint8Array(16 * 1024);
    while (true) {
      const n = await transport.read(buf);
      if (n === null) break;
      if (n === 0) continue;
      total += n;
      if (total > maxBytes + MAX_HEADER_BYTES) return { ok: false, reason: 'too_large' };
      chunks.push(buf.slice(0, n));
      if (headerEnd < 0) {
        const all = concat(chunks, total);
        headerEnd = indexOfCRLFCRLF(all);
        if (headerEnd < 0) {
          if (total > MAX_HEADER_BYTES) return { ok: false, reason: 'bad_response' };
          continue;
        }
        const lines = new TextDecoder().decode(all.subarray(0, headerEnd)).split('\r\n');
        const m = /^HTTP\/1\.[01] (\d{3})/.exec(lines[0] ?? '');
        if (!m) return { ok: false, reason: 'bad_response' };
        status = Number(m[1]);
        headers = Object.fromEntries(lines.slice(1).map((l) => {
          const k = l.indexOf(':');
          return [l.slice(0, k).trim().toLowerCase(), l.slice(k + 1).trim()];
        }));
        if (status >= 300 && status < 400) return { ok: false, reason: 'redirect' };   // never followed
        if (status < 200 || status >= 300) return { ok: false, reason: 'http_error' };
        const cl = headers['content-length'];
        if (cl !== undefined && (!/^\d+$/.test(cl) || Number(cl) > maxBytes)) return { ok: false, reason: 'too_large' };
        const enc = (headers['content-encoding'] ?? 'identity').toLowerCase();
        if (enc !== 'identity') return { ok: false, reason: 'bad_response' };
      }
    }
    if (headerEnd < 0) return { ok: false, reason: 'bad_response' };
    let body = concat(chunks, total).subarray(headerEnd + 4);
    if ((headers['transfer-encoding'] ?? '').toLowerCase().includes('chunked')) {
      const decoded = decodeChunked(body);
      if (!decoded) return { ok: false, reason: 'bad_response' };
      body = decoded;
    } else if (headers['content-length'] !== undefined) {
      body = body.subarray(0, Number(headers['content-length']));
    }
    if (body.length > maxBytes) return { ok: false, reason: 'too_large' };
    return { ok: true, text: new TextDecoder().decode(body) };
  })().catch((): FetchResult => ({ ok: false, reason: 'bad_response' }));

  const deadline = new Promise<FetchResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    try { (transport as Transport | null)?.close(); } catch { /* already closed */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request handling
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

export interface AuthUser { id: string; email: string | null; emailConfirmed: boolean }

export interface HandlerDeps extends NetDeps {
  /** Service-role Supabase client. */
  db: Db;
  /** Verifies a user access token (auth.getUser). null for anon/service/invalid tokens. */
  getUserFromToken: (token: string) => Promise<AuthUser | null>;
  now?: () => Date;
  /** Server-side diagnostics: ids and categories only. */
  log?: (event: string, fields?: Record<string, string | number | boolean | null>) => void;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPPORTED_ACTIONS = new Set(['add-calendar', 'remove-calendar', 'sync-calendar', 'sync-all']);
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function json(body: Row, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function idFrom(v: unknown, name: string): string {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  if (!s || !ID_RE.test(s)) throw new HttpError(400, `Missing or invalid ${name}`);
  return s;
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const db = deps.db;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  async function requireUser(req: Request): Promise<AuthUser & { email: string }> {
    const m = /^Bearer\s+(.+)$/i.exec((req.headers.get('authorization') ?? '').trim());
    if (!m) throw new HttpError(401, 'Unauthorized');
    let user: AuthUser | null = null;
    try { user = await deps.getUserFromToken(m[1].trim()); } catch { user = null; }
    if (!user || !user.id || !user.email || !user.emailConfirmed) throw new HttpError(401, 'Unauthorized');
    return user as AuthUser & { email: string };
  }

  /** Property must exist and belong to the authenticated user (server-side host_email). */
  async function requireOwnedProperty(user: AuthUser & { email: string }, propertyId: string): Promise<Row> {
    const { data, error } = await db.from('property_applications').select('id, host_email').eq('id', propertyId).maybeSingle();
    if (error) throw new HttpError(500, 'Request failed');
    if (!data) throw new HttpError(404, 'Property not found');
    if (!data.host_email || String(data.host_email).trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new HttpError(403, 'Forbidden');
    }
    return data;
  }

  /** Calendar must exist and belong to a property owned by the authenticated user. */
  async function requireOwnedCalendar(user: AuthUser & { email: string }, calendarId: string): Promise<{ cal: Row; property: Row }> {
    const { data: cal, error } = await db.from('external_calendars').select('id, property_id, platform, ical_url').eq('id', calendarId).maybeSingle();
    if (error) throw new HttpError(500, 'Request failed');
    if (!cal) throw new HttpError(404, 'Calendar not found');
    const property = await requireOwnedProperty(user, String(cal.property_id)).catch((e) => {
      // A calendar pointing at another host's (or a missing) property is not yours.
      if (e instanceof HttpError && (e.status === 403 || e.status === 404)) throw new HttpError(403, 'Forbidden');
      throw e;
    });
    return { cal, property };
  }

  async function syncCalendar(cal: Row, ownerEmail: string): Promise<{ success: boolean; imported?: number; total_parsed?: number; message?: string; error?: string }> {
    const calId = String(cal.id);
    const fetched = await safeFetchCalendar(String(cal.ical_url ?? ''), deps);
    if (!fetched.ok) {
      log('calendar_fetch_failed', { calendarId: calId, reason: fetched.reason });
      await db.from('external_calendars')
        .update({ sync_status: 'error', sync_error: fetched.reason, last_synced: now().toISOString() })
        .eq('id', calId);
      return { success: false, error: 'Could not fetch the calendar' };
    }

    const events = parseICS(fetched.text);
    const today = now().toISOString().slice(0, 10);

    const { error: delErr } = await db.from('ical_blocked_dates').delete().eq('calendar_id', calId).eq('property_id', String(cal.property_id));
    if (delErr) {
      log('calendar_sync_failed', { calendarId: calId, stage: 'delete' });
      return { success: false, error: 'Could not update the calendar' };
    }

    const toInsert = events
      .filter((e) => e.end >= today)
      .map((e) => ({
        property_id: cal.property_id,
        host_email: ownerEmail,
        start_date: e.start,
        end_date: e.end,
        summary: e.summary || `${cal.platform} Booking`,
        uid: e.uid || null,
        source: cal.platform,
        platform: cal.platform,
        calendar_id: calId,
      }));

    if (toInsert.length > 0) {
      const { error: insErr } = await db.from('ical_blocked_dates').insert(toInsert);
      if (insErr) {
        log('calendar_sync_failed', { calendarId: calId, stage: 'insert' });
        await db.from('external_calendars').update({ sync_status: 'error', sync_error: 'store_failed', last_synced: now().toISOString() }).eq('id', calId);
        return { success: false, error: 'Could not update the calendar' };
      }
    }

    await db.from('external_calendars').update({ sync_status: 'synced', sync_error: null, last_synced: now().toISOString() }).eq('id', calId);
    log('calendar_synced', { calendarId: calId, imported: toInsert.length });
    return {
      success: true,
      imported: toInsert.length,
      total_parsed: events.length,
      message: `Synced ${toInsert.length} blocked period(s) from ${cal.platform}`,
    };
  }

  async function handleExport(propertyId: string): Promise<Response> {
    // Behaviour unchanged from the previous implementation, except that a server
    // error no longer echoes the raw error text.
    try {
      const { data: prop } = await db.from('property_applications').select('id, title').eq('id', propertyId).maybeSingle();
      if (!prop) return new Response('Property not found', { status: 404, headers: corsHeaders });
      const [{ data: bookings }, { data: blockedDates }] = await Promise.all([
        db.from('bookings').select('id, check_in, check_out').eq('property_id', propertyId)
          .in('status', ['confirmed', 'pending', 'pending_host_approval']).order('check_in', { ascending: true }),
        db.from('blocked_dates').select('id, start_date, end_date').eq('property_id', propertyId).order('start_date', { ascending: true }),
      ]);
      const ics = generateICS(prop.title, bookings ?? [], (blockedDates ?? []).map((bd: Row) => ({ ...bd, platform: 'manual' })));
      return new Response(ics, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="rentcottage-${propertyId}.ics"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      log('export_failed');
      return json({ error: 'Request failed' }, 500);
    }
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('action') === 'export' && url.searchParams.get('property_id')) {
      return handleExport(url.searchParams.get('property_id') as string);
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    let body: Row;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Row;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const action = typeof body.action === 'string' ? body.action : '';
    // Removed legacy actions (save-url, import, refresh) and anything unknown.
    if (!SUPPORTED_ACTIONS.has(action)) return json({ error: 'Unsupported action' }, 400);

    try {
      const user = await requireUser(req);

      if (action === 'add-calendar') {
        const propertyId = idFrom(body.property_id, 'property_id');
        const platform = typeof body.platform === 'string' ? body.platform.trim().slice(0, 50) : '';
        if (!platform) return json({ error: 'platform and ical_url are required' }, 400);
        await requireOwnedProperty(user, propertyId);
        const check = checkCalendarUrl(body.ical_url);
        if (!check.ok) return json({ error: 'Invalid calendar URL.' }, 400);
        const addr = await resolvePublicAddress(check, deps);
        if (!addr.ok) return json({ error: 'Invalid calendar URL.' }, 400);
        const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 100) : null;
        const { data, error } = await db.from('external_calendars').insert({
          property_id: propertyId,
          host_email: user.email,           // verified identity, never the body value
          platform,
          label,
          ical_url: String(body.ical_url).trim(),
          sync_status: 'pending',
        }).select('id, property_id, platform, label, sync_status, created_at').maybeSingle();
        if (error || !data) {
          log('calendar_add_failed', { propertyId });
          return json({ error: 'Request failed' }, 500);
        }
        // Explicit allow-list: never echo ical_url or host_email back.
        const calendar = { id: data.id, property_id: data.property_id, platform: data.platform, label: data.label, sync_status: data.sync_status, created_at: data.created_at };
        return json({ success: true, calendar });
      }

      if (action === 'remove-calendar') {
        const calendarId = idFrom(body.calendar_id, 'calendar_id');
        // Ownership FIRST; nothing is deleted before this succeeds.
        const { cal } = await requireOwnedCalendar(user, calendarId);
        const { error: blocksErr } = await db.from('ical_blocked_dates').delete().eq('calendar_id', calendarId).eq('property_id', String(cal.property_id));
        if (blocksErr) return json({ error: 'Request failed' }, 500);
        const { error: calErr } = await db.from('external_calendars').delete().eq('id', calendarId).eq('property_id', String(cal.property_id));
        if (calErr) return json({ error: 'Request failed' }, 500);
        return json({ success: true });
      }

      if (action === 'sync-calendar') {
        const calendarId = idFrom(body.calendar_id, 'calendar_id');
        const { cal, property } = await requireOwnedCalendar(user, calendarId);
        const result = await syncCalendar(cal, String(property.host_email));
        return json(result, result.success ? 200 : 502);
      }

      // sync-all
      const propertyId = idFrom(body.property_id, 'property_id');
      const property = await requireOwnedProperty(user, propertyId);
      const { data: calendars, error } = await db.from('external_calendars').select('id, property_id, platform, ical_url').eq('property_id', propertyId);
      if (error) return json({ error: 'Request failed' }, 500);
      if (!calendars || calendars.length === 0) return json({ success: true, message: 'No calendars to sync', synced: 0 });
      let totalImported = 0;
      const results: Row[] = [];
      for (const cal of calendars as Row[]) {
        const r = await syncCalendar(cal, String(property.host_email));
        results.push({ calendar_id: cal.id, platform: cal.platform, ...r });
        if (r.imported) totalImported += r.imported;
      }
      return json({ success: true, synced: calendars.length, total_imported: totalImported, results });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      log('unhandled_error', { action });
      return json({ error: 'Request failed' }, 500);
    }
  };
}
