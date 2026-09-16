import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.ts';

// Thin Deno wrapper. All request handling, authorization and payment-safety
// rules live in handler.ts (tested in handler.test.ts); email templates in
// templates.ts.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

const handler = createHandler({
  db: supabase,
  adminPassword: Deno.env.get('ADMIN_PANEL_PASSWORD'),
  cronSecret: Deno.env.get('CRON_SECRET'),

  getUserFromToken: async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    return {
      id: u.id,
      email: u.email ?? null,
      emailConfirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
    };
  },

  sendResend: async ({ from, to, subject, html }) => {
    if (!RESEND_API_KEY) return { status: 0, body: 'RESEND_API_KEY not configured' };
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return { status: res.status, body: await res.text().catch(() => '') };
  },

  // Unchanged BOG integration: bog-payment's INTERNAL_API_KEY-gated
  // internal-refund action performs the refund and sets payment_status.
  requestRefund: async (bookingId) => {
    const key = Deno.env.get('INTERNAL_API_KEY') ?? '';
    if (!key) {
      console.error('[booking-handler] INTERNAL_API_KEY missing — refund not attempted');
      return { ok: false };
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bog-payment?action=internal-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': key },
        body: JSON.stringify({ bookingId }),
      });
      await res.text().catch(() => '');
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  },

  log: (event, fields) => {
    console.log(`[booking-handler] ${event}`, fields ? JSON.stringify(fields) : '');
  },
});

Deno.serve(handler);
