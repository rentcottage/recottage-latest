import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// Thin Deno wrapper. The gate, the action whitelist and the response shaping
// live in handler.ts (tested in handler.test.ts).
//
// Deployed with verify_jwt = false: n8n holds no Supabase session and no
// database credential — x-n8n-secret is the only gate. The service-role client
// below never leaves this function.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const handler = createHandler({
  db: supabase,
  // The same service-role client, narrowed to the Storage surface the two reel
  // actions use. It never leaves this function either: what goes out is a
  // signed upload URL for one object path this function picked.
  storage: supabase.storage,
  secret: Deno.env.get("N8N_DATA_SECRET"),
  log: (event, fields) => {
    console.log(`[n8n-data] ${event}`, fields ? JSON.stringify(fields) : "");
  },
});

Deno.serve(handler);
