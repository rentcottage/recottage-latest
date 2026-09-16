import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHandler, type ApprovalApplication } from './handler.ts';

// Admin-only: re-sends the "your cottage is approved" email to the host of an
// approved application. Authorization and response rules live in handler.ts.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = 'noreply@rentcottage.ge';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const handler = createHandler({
  adminPassword: Deno.env.get('ADMIN_PANEL_PASSWORD'),

  loadApplication: async (id) => {
    const { data, error } = await supabase
      .from('property_applications')
      .select('id, status, title, location, price_per_night, host_first_name, host_last_name, host_email')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('property_applications lookup failed');
    return (data as ApprovalApplication | null) ?? null;
  },

  sendEmail: async ({ to, subject, html }) => {
    if (!RESEND_API_KEY) return { ok: false, status: 0 };
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      });
      // Drain the body without logging it — Resend errors can echo the recipient.
      await res.text().catch(() => '');
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    }
  },

  log: (event, fields) => {
    console.log(`[resend-approval-email] ${event}`, JSON.stringify(fields));
  },
});

Deno.serve(handler);
