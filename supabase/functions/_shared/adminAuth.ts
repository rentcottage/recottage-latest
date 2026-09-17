/**
 * Admin password check and failed-attempt throttle, shared by admin-read and
 * admin-host-actions.
 *
 * SECURITY RULES THIS MODULE ENFORCES
 * - The password is read from the `x-admin-password` header only. A password
 *   in the request body is ignored (bodies end up in logs, proxies and
 *   browser history far more often than headers do).
 * - Comparison is SHA-256 + constant time over the two digests, so neither the
 *   length nor any prefix of the secret leaks through timing or through an
 *   early return.
 * - Fail closed: an unset/empty ADMIN_PANEL_PASSWORD denies everything.
 * - Every failure answers with the same generic 401 body.
 * - After MAX_FAILURES failures from one client within WINDOW_MS, that client
 *   gets 429 until the oldest failure in the window ages out. Successes clear
 *   nothing, so one client cannot unblock another.
 *
 * No Deno globals and no network imports: unit-testable with `node --test`
 * (adminAuth.test.ts). The caller injects a service-role Supabase client.
 */

/** Failures tolerated per client within the window. */
export const MAX_FAILURES = 10;
/** Sliding window, in milliseconds. */
export const WINDOW_MS = 15 * 60 * 1000;
/** Table the failures live in (service-role only). */
export const FAILURES_TABLE = 'admin_auth_failures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThrottleDb = { from: (table: string) => any };

async function sha256Bytes(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** Hex SHA-256 — used for the client-IP key, never for the password. */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = await sha256Bytes(value);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** How a password is turned into bytes before comparison. */
export type Digest = (value: string) => Promise<Uint8Array>;

/**
 * Constant-time password comparison.
 *
 * BOTH inputs are always hashed — there is deliberately no length check and no
 * early return — so `provided` and `expected` differing in length costs exactly
 * the same as differing in the last byte. `digest` is injectable so a test can
 * prove that both sides really are hashed on every path (adminAuth.test.ts).
 */
export async function passwordMatches(
  provided: string,
  expected: string | undefined,
  digest: Digest = sha256Bytes,
): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The password as this codebase accepts it: header only. */
export function providedPassword(req: Request): string {
  return req.headers.get('x-admin-password') ?? '';
}

/**
 * Stable key for one client: the first hop of x-forwarded-for (the address
 * Supabase's edge saw), hashed. Falls back to a constant bucket when the
 * header is missing, so a header-stripping caller is throttled too.
 */
export async function clientKey(req: Request): Promise<string> {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const first = xff.split(',')[0]?.trim() ?? '';
  return await sha256Hex(first || 'unknown');
}

/** True when this client has used up its failures for the current window. */
export async function isThrottled(db: ThrottleDb, ipHash: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const { count, error } = await db
    .from(FAILURES_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('failed_at', since);
  // Fail closed on a broken counter would lock the admin out of their own
  // panel during a database blip; fail open here, because the password check
  // still runs and is itself constant-time.
  if (error) return false;
  return (count ?? 0) >= MAX_FAILURES;
}

/** Records one failed attempt. Never throws: throttling is best-effort. */
export async function recordFailure(db: ThrottleDb, ipHash: string, functionName: string): Promise<void> {
  try {
    await db.from(FAILURES_TABLE).insert({ ip_hash: ipHash, function_name: functionName });
  } catch {
    // ignore
  }
}

export type AuthOutcome =
  | { ok: true }
  | { ok: false; status: 401 | 429 };

/**
 * The whole gate in one call: throttle check → password check → record failure.
 * Callers turn a non-ok outcome into the generic body themselves so each
 * function keeps its own CORS headers.
 */
export async function authorizeAdmin(
  req: Request,
  deps: { db: ThrottleDb; adminPassword: string | undefined; functionName: string },
): Promise<AuthOutcome> {
  const ipHash = await clientKey(req);
  if (await isThrottled(deps.db, ipHash)) return { ok: false, status: 429 };
  if (await passwordMatches(providedPassword(req), deps.adminPassword)) return { ok: true };
  await recordFailure(deps.db, ipHash, deps.functionName);
  return { ok: false, status: 401 };
}
