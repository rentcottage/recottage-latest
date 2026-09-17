/**
 * Password-gated read-only admin data (supabase/functions/admin-read).
 * The admin dashboard has no Supabase session; the admin password kept in
 * sessionStorage by AdminGate is sent as `x-admin-password`.
 */

const ADMIN_READ_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-read`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

export type AdminReadResult<T> = { ok: true; data: T } | { ok: false; status: number };

export async function adminRead<T>(action: string, params: Record<string, unknown> = {}): Promise<AdminReadResult<T>> {
  try {
    const res = await fetch(ADMIN_READ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-admin-password': sessionStorage.getItem('rc_admin_pw') ?? '',
      },
      body: JSON.stringify({ action, ...params }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
