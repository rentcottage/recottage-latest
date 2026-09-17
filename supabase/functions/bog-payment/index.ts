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
  now: () => Date.now(),
  getUserFromToken: async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const u = data.user;
    return { id: u.id, email: u.email ?? null, emailConfirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at) };
  },
});

Deno.serve(handler);
