import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// Thin Deno wrapper. Password check, validation and queries live in handler.ts
// (tested in handler.test.ts). Deployed with verify_jwt = false: the admin
// dashboard has no Supabase session; x-admin-password is the gate.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const handler = createHandler({
  db: supabase,
  adminPassword: Deno.env.get("ADMIN_PANEL_PASSWORD"),
  log: (event, fields) => {
    console.log(`[admin-read] ${event}`, fields ? JSON.stringify(fields) : "");
  },
});

Deno.serve(handler);
