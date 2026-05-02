import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@rentcottage.ge";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "RentCottage.Ge";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Bounce classification ────────────────────────────────────────────────────
const PERMANENT_BOUNCE_CODES = [
  "email_not_deliverable",
  "invalid_email",
  "mailbox_does_not_exist",
  "invalid_to",
];

function isPermanentFailure(httpStatus: number, errorBody: string): boolean {
  if (httpStatus === 422) return true;
  if (httpStatus === 400) {
    const lower = errorBody.toLowerCase();
    if (PERMANENT_BOUNCE_CODES.some(c => lower.includes(c))) return true;
    if (lower.includes("invalid") && lower.includes("email")) return true;
  }
  return false;
}

function isTransientFailure(httpStatus: number): boolean {
  return httpStatus === 429 || httpStatus >= 500;
}

// ─── Delivery log ─────────────────────────────────────────────────────────────
type EmailDeliveryStatus = "sent" | "transient_failure" | "permanent_failure" | "skipped_blocked";

interface LogDeliveryOpts {
  recipientEmail: string;
  subject?: string | null;
  context?: string | null;
  contextId?: string | null;
  status: EmailDeliveryStatus;
  httpStatus?: number | null;
  errorMessage?: string | null;
  attemptNumber?: number;
  retryAfter?: Date | null;
}

async function logDelivery(opts: LogDeliveryOpts): Promise<void> {
  try {
    await supabase.from("email_delivery_logs").insert({
      recipient_email: opts.recipientEmail.toLowerCase().trim(),
      subject: opts.subject ?? null,
      context: opts.context ?? null,
      context_id: opts.contextId ?? null,
      status: opts.status,
      http_status: opts.httpStatus ?? null,
      error_message: opts.errorMessage ?? null,
      attempt_number: opts.attemptNumber ?? 1,
      retry_after: opts.retryAfter ? opts.retryAfter.toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[logDelivery] Failed to log:", e);
  }
}

// ─── Smart sendEmail ──────────────────────────────────────────────────────────
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  context = "broadcast",
  contextId?: string,
  maxRetries = 3,
  retryDelayMs = 1000
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email to", to);
    return true; // treat as success in dev
  }

  // ── Skip if permanently blocked ──────────────────────────────────────────
  const { data: blocked } = await supabase
    .from("blocked_emails")
    .select("id, bounce_type")
    .eq("email", to.toLowerCase().trim())
    .maybeSingle();

  if (blocked) {
    console.warn(`[sendEmail] Skipping blocked email: ${to}`);
    await logDelivery({ recipientEmail: to, subject, context, contextId, status: "skipped_blocked", errorMessage: `Blocked (${blocked.bounce_type ?? "permanent"})` });
    return false;
  }

  let lastHttpStatus: number | null = null;
  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [to],
          subject,
          html,
        }),
      });

      lastHttpStatus = res.status;

      if (res.ok) {
        console.log(`[sendEmail] Sent to ${to} (attempt ${attempt})`);
        await logDelivery({ recipientEmail: to, subject, context, contextId, status: "sent", httpStatus: res.status, attemptNumber: attempt });
        return true;
      }

      const err = await res.text();
      lastErrorMessage = `HTTP ${res.status}: ${err}`;
      console.error(`[sendEmail] Attempt ${attempt}/${maxRetries} for ${to}:`, lastErrorMessage);

      if (isPermanentFailure(res.status, err)) {
        console.warn(`[sendEmail] Permanent failure for ${to} — blocking`);
        await supabase.from("blocked_emails").upsert({
          email: to.toLowerCase().trim(),
          blocked_reason: `Permanent bounce: ${err.slice(0, 300)}`,
          blocked_at: new Date().toISOString(),
          source: `${context}/${contextId ?? "unknown"}`,
          bounce_type: "permanent",
        }, { onConflict: "email" });
        await logDelivery({ recipientEmail: to, subject, context, contextId, status: "permanent_failure", httpStatus: res.status, errorMessage: err.slice(0, 500), attemptNumber: attempt });
        return false;
      }

      if (isTransientFailure(res.status)) {
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[sendEmail] Transient (${res.status}) — retry in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        await logDelivery({ recipientEmail: to, subject, context, contextId, status: "transient_failure", httpStatus: res.status, errorMessage: err.slice(0, 500), attemptNumber: attempt, retryAfter: new Date(Date.now() + 15 * 60 * 1000) });
        return false;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      await logDelivery({ recipientEmail: to, subject, context, contextId, status: "transient_failure", httpStatus: res.status, errorMessage: err.slice(0, 500), attemptNumber: attempt, retryAfter: new Date(Date.now() + 15 * 60 * 1000) });
      return false;

    } catch (e) {
      lastErrorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[sendEmail] Exception attempt ${attempt}:`, e);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      await logDelivery({ recipientEmail: to, subject, context, contextId, status: "transient_failure", httpStatus: lastHttpStatus, errorMessage: lastErrorMessage?.slice(0, 500) ?? "Exception", attemptNumber: attempt, retryAfter: new Date(Date.now() + 15 * 60 * 1000) });
      return false;
    }
  }
  return false;
}

function buildEmailHtml(subject: string, body: string): string {
  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#e53e3e;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">RentCottage.Ge</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Host Announcement</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827;">${subject}</h2>
              <div style="font-size:15px;line-height:1.7;color:#374151;">${htmlBody}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#f3f4f6;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This message was sent to you as a registered host on RentCottage.Ge.<br>
                If you have any questions, please contact us at <a href="mailto:${FROM_EMAIL}" style="color:#e53e3e;">${FROM_EMAIL}</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── fetch-history ──────────────────────────────────────────────────────
    if (action === "fetch-history") {
      const { data, error } = await supabase
        .from("host_email_broadcasts")
        .select("id, subject, sent_at, recipient_count, sent_by_admin")
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, broadcasts: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── send-broadcast ─────────────────────────────────────────────────────
    if (action === "send-broadcast") {
      const { subject, body: emailBody, sentByAdmin } = body;

      if (!subject?.trim() || !emailBody?.trim()) {
        return new Response(JSON.stringify({ success: false, error: "Subject and body are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: applications, error: appError } = await supabase
        .from("property_applications")
        .select("host_email, host_first_name, host_last_name, title")
        .eq("status", "approved");

      if (appError) {
        return new Response(JSON.stringify({ success: false, error: appError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!applications || applications.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "No approved hosts found to send to." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduplicate by email
      const uniqueEmails = new Map<string, { email: string; name: string }>();
      for (const app of applications) {
        if (app.host_email && !uniqueEmails.has(app.host_email)) {
          uniqueEmails.set(app.host_email, {
            email: app.host_email,
            name: `${app.host_first_name ?? ""} ${app.host_last_name ?? ""}`.trim(),
          });
        }
      }

      const recipients = Array.from(uniqueEmails.values());
      const htmlContent = buildEmailHtml(subject.trim(), emailBody.trim());
      const broadcastId = `broadcast_${Date.now()}`;

      let successCount = 0;
      let skippedCount = 0;

      for (const recipient of recipients) {
        const ok = await sendEmail(
          recipient.email,
          subject.trim(),
          htmlContent,
          "host_broadcast",
          broadcastId
        );
        if (ok) {
          successCount++;
        } else {
          skippedCount++;
        }
        // Small delay between sends to avoid rate limits
        await new Promise(r => setTimeout(r, 100));
      }

      // Save broadcast record
      const { error: insertError } = await supabase
        .from("host_email_broadcasts")
        .insert({
          subject: subject.trim(),
          body: emailBody.trim(),
          sent_at: new Date().toISOString(),
          recipient_count: successCount,
          sent_by_admin: sentByAdmin ?? "admin",
        });

      if (insertError) {
        console.error("Failed to save broadcast record:", insertError.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          recipientCount: successCount,
          skippedCount,
          totalRecipients: recipients.length,
          message: `Email sent to ${successCount} of ${recipients.length} hosts. ${skippedCount > 0 ? `${skippedCount} skipped (blocked or failed).` : ""}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("host-broadcast error:", e);
    return new Response(JSON.stringify({ success: false, error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
