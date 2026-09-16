import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.ts';

// Thin Deno wrapper. Authorization, eligibility, claim-before-send and failure
// semantics live in handler.ts (tested in handler.test.ts); the email template
// in templates.ts. Invoked only by Supabase Cron with `x-cron-secret`.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const handler = createHandler({
  db: supabase,
  cronSecret: Deno.env.get('CRON_SECRET'),

  sendResend: async ({ from, to, subject, html, idempotencyKey }) => {
    if (!RESEND_API_KEY) return { status: 0, body: '' };
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          // Second guard against duplicates: Resend returns the original result
          // for a repeated key instead of sending again.
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      // The body is only used to classify permanent failures; never logged.
      return { status: res.status, body: await res.text().catch(() => '') };
    } catch {
      return { status: 0, body: '' };
    }
  },

  log: (event, fields) => {
    console.log(`[booking-reminders] ${event}`, fields ? JSON.stringify(fields) : '');
  },
});

Deno.serve(handler);
