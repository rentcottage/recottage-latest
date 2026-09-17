import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createExportHandler } from "./handler.ts";

// Thin Deno wrapper. Token validation, eligibility and feed generation live in
// handler.ts (tested in handler.test.ts). Deployed with verify_jwt = false:
// the per-property token in the URL is the only credential.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const handler = createExportHandler({
  db: supabase,
  log: (event, fields) => {
    console.log(`[ical-export] ${event}`, fields ? JSON.stringify(fields) : "");
  },
});

Deno.serve(handler);
