/**
 * Which actions of admin-user-management are public, and the admin gate for
 * every other one — including `verify-admin`, the admin panel's login check.
 *
 * WHY THIS IS ITS OWN MODULE
 * `verify-admin` is the endpoint an attacker guesses against: it answers
 * "is this the admin password?" directly. It therefore runs through exactly
 * the same gate as the privileged actions (_shared/adminAuth.ts): the password
 * comes from the `x-admin-password` header only, it is compared as SHA-256
 * digests in constant time with no length check anywhere, an unset secret
 * denies everything, every failure gets the same generic 401, and ten failures
 * from one client in fifteen minutes turn into 429s.
 *
 * The throttle is keyed by CLIENT, never by action or function, so failures
 * against verify-admin, the other actions here, admin-read and
 * admin-host-actions all count towards the same budget — switching action or
 * function is not a way around it.
 *
 * `check-email` and `check-availability` stay open: the public signup flow
 * calls them before anyone has an account, and they are not password checks,
 * so they neither consume nor are blocked by the admin budget.
 *
 * Deno-global-free and network-import-free so it can be unit-tested with
 * `node --test` (gate.test.ts).
 */
import { authorizeAdmin, type ThrottleDb } from '../_shared/adminAuth.ts';

/** Actions the public signup flow needs, which are not password-gated. */
export const PUBLIC_ACTIONS = ['check-email', 'check-availability'] as const;

export const FUNCTION_NAME = 'admin-user-management';

export function isPublicAction(action: unknown): boolean {
  return typeof action === 'string' && (PUBLIC_ACTIONS as readonly string[]).includes(action);
}

export interface GateDeps {
  db: ThrottleDb;
  adminPassword: string | undefined;
  /** Builds the function's error response, so CORS headers stay in one place. */
  jsonErr: (msg: string, status: number) => Response;
}

/**
 * Returns a response to send back, or null when the request may proceed.
 * A public action always proceeds without touching the throttle.
 */
export async function gate(req: Request, action: unknown, deps: GateDeps): Promise<Response | null> {
  if (isPublicAction(action)) return null;

  const outcome = await authorizeAdmin(req, {
    db: deps.db,
    adminPassword: deps.adminPassword,
    functionName: FUNCTION_NAME,
  });
  if (outcome.ok) return null;

  // Identical body for a missing, wrong-length and wrong-value password: the
  // response must not tell an attacker which part was wrong.
  return outcome.status === 429
    ? deps.jsonErr('Too many attempts', 429)
    : deps.jsonErr('Unauthorized', 401);
}
