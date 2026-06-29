import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonErr(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonErr('Method not allowed', 405);
  }

  // Use service role key — required for admin auth operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid JSON body');
  }

  const { action } = body as { action?: string };

  // ── Admin authorization ─────────────────────────────────────────────────────
  // Sensitive actions require the server-side admin secret, which is NOT shipped
  // in the client bundle. Only `check-email` (used by the public signup flow) and
  // `verify-admin` (the login check) are reachable without it.
  const ADMIN_PASSWORD = Deno.env.get('ADMIN_PANEL_PASSWORD') ?? '';
  const provided = (body.adminPassword as string | undefined) ?? req.headers.get('x-admin-password') ?? '';

  const timingSafeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length || a.length === 0) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };
  const isAdmin = ADMIN_PASSWORD.length > 0 && timingSafeEqual(provided, ADMIN_PASSWORD);

  // Login check used by the admin gate — returns whether the password is valid.
  if (action === 'verify-admin') {
    return isAdmin ? jsonOk({ success: true }) : jsonErr('Invalid password', 401);
  }

  // Everything except the public signup email-check requires admin.
  if (action !== 'check-email' && !isAdmin) {
    return jsonErr('Unauthorized', 401);
  }

  // ── Fetch all users ────────────────────────────────────────────────────────
  if (action === 'fetch-users') {
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return jsonErr('Failed to fetch users', 500);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, phone, phone_verified, role, created_at');

    const profileMap = new Map((profiles ?? []).map((p: Record<string, unknown>) => [p.id, p]));

    const users = authData.users.map((u) => {
      const profile = profileMap.get(u.id) as Record<string, unknown> | undefined;
      return {
        id: u.id,
        email: u.email ?? '',
        full_name: (profile?.full_name as string) ?? (u.user_metadata?.full_name as string) ?? '',
        phone: (profile?.phone as string) ?? '',
        phone_verified: !!profile?.phone_verified,
        role: (profile?.role as string) ?? 'customer',
        provider: u.app_metadata?.provider ?? 'email',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: !!u.email_confirmed_at,
      };
    });

    return jsonOk({ success: true, users });
  }

  // ── Delete user + block email ──────────────────────────────────────────────
  if (action === 'delete-user') {
    const { userId, email, reason } = body as {
      userId?: string;
      email?: string;
      reason?: string;
    };

    if (!userId || !email) return jsonErr('Missing userId or email');

    // 1. Delete from Supabase Auth (service role required)
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error('[delete-user] Auth delete error:', deleteErr);
      return jsonErr(`Failed to delete user: ${deleteErr.message}`, 500);
    }

    // 2. Delete profile row
    await supabase.from('profiles').delete().eq('id', userId);

    // 3. Insert into blocked_emails (upsert to avoid duplicate key error)
    const { error: blockErr } = await supabase.from('blocked_emails').upsert(
      {
        email: email.toLowerCase().trim(),
        blocked_reason: reason?.trim() || 'Deleted by admin',
        source: 'deleted_from_supabase',
        blocked_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    if (blockErr) {
      console.error('[delete-user] Block email error:', blockErr);
      // User was deleted but blocking failed — still return partial success
      return jsonOk({ success: true, blocked: false, warning: 'User deleted but email blocking failed' });
    }

    return jsonOk({ success: true, blocked: true });
  }

  // ── Block email only (without deleting user) ──────────────────────────────
  if (action === 'block-email') {
    const { email, reason } = body as { email?: string; reason?: string };
    if (!email) return jsonErr('Missing email');

    const { error: blockErr } = await supabase.from('blocked_emails').upsert(
      {
        email: email.toLowerCase().trim(),
        blocked_reason: reason?.trim() || 'Blocked by admin',
        source: 'manual_block',
        blocked_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    if (blockErr) return jsonErr('Failed to block email', 500);
    return jsonOk({ success: true });
  }

  // ── Unblock email ─────────────────────────────────────────────────────────
  if (action === 'unblock-email') {
    const { email } = body as { email?: string };
    if (!email) return jsonErr('Missing email');

    const { error } = await supabase
      .from('blocked_emails')
      .delete()
      .eq('email', email.toLowerCase().trim());

    if (error) return jsonErr('Failed to unblock email', 500);
    return jsonOk({ success: true });
  }

  // ── Fetch blocked emails ──────────────────────────────────────────────────
  if (action === 'fetch-blocked') {
    const { data, error } = await supabase
      .from('blocked_emails')
      .select('*')
      .order('blocked_at', { ascending: false });

    if (error) return jsonErr('Failed to fetch blocked emails', 500);
    return jsonOk({ success: true, blocked: data ?? [] });
  }

  // ── Check if email is blocked (used by frontend before sign-up) ───────────
  if (action === 'check-email') {
    const { email } = body as { email?: string };
    if (!email) return jsonErr('Missing email');

    const { data } = await supabase
      .from('blocked_emails')
      .select('email, blocked_reason')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    return jsonOk({ blocked: !!data, reason: data?.blocked_reason ?? null });
  }

  return jsonErr('Unknown action');
});
