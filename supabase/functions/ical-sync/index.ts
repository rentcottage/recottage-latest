import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// ─── iCal parser ────────────────────────────────────────────────────────────
function parseICS(text: string): Array<{ uid: string; summary: string; start: string; end: string }> {
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

function parseICalDate(icalDate: string): string {
  if (/^\d{8}$/.test(icalDate)) {
    return `${icalDate.slice(0, 4)}-${icalDate.slice(4, 6)}-${icalDate.slice(6, 8)}`;
  }
  const match = icalDate.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return icalDate;
}

// ─── iCal generator (export from our website) ────────────────────────────────
function generateICS(
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

// ─── Main handler ─────────────────────────────────────────────────────────────
// ── SSRF guard ──────────────────────────────────────────────────────────────
// Block non-http(s) schemes and private / loopback / link-local / cloud-metadata
// hosts so a host-supplied ical_url can't probe internal services (169.254.169.254 etc).
function isSafeHttpUrl(raw: unknown): boolean {
  let u: URL;
  try { u = new URL(String(raw).trim()); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return false;        // unspecified / private / loopback
    if (a === 169 && b === 254) return false;                  // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;         // private
    if (a === 192 && b === 168) return false;                  // private
    if (a === 100 && b >= 64 && b <= 127) return false;        // CGNAT
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const propertyId = url.searchParams.get("property_id");

  // ── EXPORT: GET /ical-sync?action=export&property_id=xxx ──────────────────
  if (req.method === "GET" && action === "export" && propertyId) {
    try {
      const { data: prop } = await supabase
        .from("property_applications")
        .select("id, title")
        .eq("id", propertyId)
        .maybeSingle();

      if (!prop) {
        return new Response("Property not found", { status: 404, headers: corsHeaders });
      }

      const [{ data: bookings }, { data: blockedDates }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, check_in, check_out")
          .eq("property_id", propertyId)
          .in("status", ["confirmed", "pending", "pending_host_approval"])
          .order("check_in", { ascending: true }),
        supabase
          .from("blocked_dates")
          .select("id, start_date, end_date")
          .eq("property_id", propertyId)
          .order("start_date", { ascending: true }),
      ]);

      const ics = generateICS(
        prop.title,
        bookings ?? [],
        (blockedDates ?? []).map((bd) => ({ ...bd, platform: "manual" }))
      );

      return new Response(ics, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="rentcottage-${propertyId}.ics"`,
          "Cache-Control": "no-cache",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── POST actions ──────────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { action: bodyAction, property_id: bodyPropId, host_email } = body;

      // ── Add a new external calendar ──
      if (bodyAction === "add-calendar") {
        const { platform, label, ical_url } = body;
        if (!platform || !ical_url) {
          return new Response(JSON.stringify({ error: "platform and ical_url are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!isSafeHttpUrl(ical_url)) {
          return new Response(JSON.stringify({ error: "Invalid calendar URL." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("external_calendars")
          .insert({
            property_id: bodyPropId,
            host_email,
            platform,
            label: label || null,
            ical_url: ical_url.trim(),
            sync_status: "pending",
          })
          .select()
          .maybeSingle();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, calendar: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Remove an external calendar ──
      if (bodyAction === "remove-calendar") {
        const { calendar_id } = body;
        if (!calendar_id) {
          return new Response(JSON.stringify({ error: "calendar_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete blocked dates for this calendar
        await supabase.from("ical_blocked_dates").delete().eq("calendar_id", calendar_id);
        // Delete the calendar entry
        const { error } = await supabase
          .from("external_calendars")
          .delete()
          .eq("id", calendar_id)
          .eq("host_email", host_email);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Sync a single calendar ──
      if (bodyAction === "sync-calendar") {
        const { calendar_id } = body;
        if (!calendar_id) {
          return new Response(JSON.stringify({ error: "calendar_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: cal } = await supabase
          .from("external_calendars")
          .select("*")
          .eq("id", calendar_id)
          .eq("host_email", host_email)
          .maybeSingle();

        if (!cal) {
          return new Response(JSON.stringify({ error: "Calendar not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return await syncCalendar(supabase, cal);
      }

      // ── Sync ALL calendars for a property ──
      if (bodyAction === "sync-all") {
        const { data: calendars } = await supabase
          .from("external_calendars")
          .select("*")
          .eq("property_id", bodyPropId)
          .eq("host_email", host_email);

        if (!calendars || calendars.length === 0) {
          return new Response(JSON.stringify({ success: true, message: "No calendars to sync", synced: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let totalImported = 0;
        const results = [];
        for (const cal of calendars) {
          const res = await syncCalendar(supabase, cal);
          const data = await res.json();
          results.push({ calendar_id: cal.id, platform: cal.platform, ...data });
          if (data.imported) totalImported += data.imported;
        }

        return new Response(
          JSON.stringify({ success: true, synced: calendars.length, total_imported: totalImported, results }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Legacy: save-url (backward compat) ──
      if (bodyAction === "save-url") {
        const { ical_url } = body;
        if (!isSafeHttpUrl(ical_url)) {
          return new Response(JSON.stringify({ error: "Invalid calendar URL." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase
          .from("property_applications")
          .update({ ical_url })
          .eq("id", bodyPropId)
          .eq("host_email", host_email);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Legacy: import (backward compat) ──
      if (bodyAction === "import" || bodyAction === "refresh") {
        let icalUrl = body.ical_url;
        if (!icalUrl) {
          const { data: prop } = await supabase
            .from("property_applications")
            .select("ical_url")
            .eq("id", bodyPropId)
            .eq("host_email", host_email)
            .maybeSingle();
          if (!prop?.ical_url) {
            return new Response(JSON.stringify({ error: "No iCal URL configured" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          icalUrl = prop.ical_url;
        }

        const fakeCal = {
          id: null,
          property_id: bodyPropId,
          host_email,
          platform: "airbnb",
          ical_url: icalUrl,
        };
        return await syncCalendar(supabase, fakeCal);
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ─── Sync a single external calendar ─────────────────────────────────────────
async function syncCalendar(supabase: ReturnType<typeof createClient>, cal: {
  id: string | null;
  property_id: string;
  host_email: string;
  platform: string;
  ical_url: string;
}): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };

  let icsText: string;
  try {
    // Defense-in-depth: re-validate before fetching (covers legacy stored URLs).
    if (!isSafeHttpUrl(cal.ical_url)) throw new Error("unsafe ical_url blocked");
    const icsRes = await fetch(cal.ical_url, {
      headers: { "User-Agent": "RentCottage-iCal-Sync/2.0" },
    });
    if (!icsRes.ok) throw new Error(`HTTP ${icsRes.status}`);
    icsText = await icsRes.text();
  } catch (fetchErr) {
    // Update error status
    if (cal.id) {
      await supabase
        .from("external_calendars")
        .update({ sync_status: "error", sync_error: String(fetchErr), last_synced: new Date().toISOString() })
        .eq("id", cal.id);
    }
    return new Response(JSON.stringify({ error: `Failed to fetch iCal: ${fetchErr}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const events = parseICS(icsText);
  const today = new Date().toISOString().slice(0, 10);

  // Delete existing blocks for this calendar (or by property+source for legacy)
  if (cal.id) {
    await supabase.from("ical_blocked_dates").delete().eq("calendar_id", cal.id);
  } else {
    await supabase
      .from("ical_blocked_dates")
      .delete()
      .eq("property_id", cal.property_id)
      .eq("source", cal.platform);
  }

  const toInsert = events
    .filter((e) => e.end >= today)
    .map((e) => ({
      property_id: cal.property_id,
      host_email: cal.host_email,
      start_date: e.start,
      end_date: e.end,
      summary: e.summary || `${cal.platform} Booking`,
      uid: e.uid || null,
      source: cal.platform,
      platform: cal.platform,
      calendar_id: cal.id || null,
    }));

  if (toInsert.length > 0) {
    await supabase.from("ical_blocked_dates").insert(toInsert);
  }

  // Update sync status
  if (cal.id) {
    await supabase
      .from("external_calendars")
      .update({
        sync_status: "synced",
        sync_error: null,
        last_synced: new Date().toISOString(),
      })
      .eq("id", cal.id);
  } else {
    await supabase
      .from("property_applications")
      .update({ ical_last_synced: new Date().toISOString() })
      .eq("id", cal.property_id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      imported: toInsert.length,
      total_parsed: events.length,
      message: `Synced ${toInsert.length} blocked period(s) from ${cal.platform}`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
