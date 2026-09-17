import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// Thin Deno wrapper. Authentication, ownership, the SSRF-safe fetcher and all
// actions live in handler.ts (tested in handler.test.ts).

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const handler = createHandler({
  db: supabase,

  getUserFromToken: async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    return { id: u.id, email: u.email ?? null, emailConfirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at) };
  },

  resolveDns: (host, type) => Deno.resolveDns(host, type),

  // Connect to the already-vetted IP; TLS verifies the certificate (and sends
  // SNI) for the original hostname. The hostname is never resolved again here.
  openTls: async (ip, port, serverName) => {
    const tcp = await Deno.connect({ hostname: ip, port });
    try {
      const tls = await Deno.startTls(tcp, { hostname: serverName });
      return {
        read: (p) => tls.read(p),
        write: (p) => tls.write(p),
        close: () => { try { tls.close(); } catch { /* already closed */ } },
      };
    } catch (e) {
      try { tcp.close(); } catch { /* already closed */ }
      throw e;
    }
  },

  log: (event, fields) => {
    console.log(`[ical-sync] ${event}`, fields ? JSON.stringify(fields) : "");
  },
});

Deno.serve(handler);
