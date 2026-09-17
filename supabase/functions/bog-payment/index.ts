import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHandler } from './handler.ts';

// Thin Deno wrapper. All request handling lives in handler.ts (tested in
// handler.test.ts); this file only wires in the real dependencies.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const handler = createHandler({
  db: supabase,
  fetch: (input, init) => fetch(input, init),
  env: (name) => Deno.env.get(name),
  envNames: () => Object.keys(Deno.env.toObject()),
  now: () => Date.now(),
});

Deno.serve(handler);
