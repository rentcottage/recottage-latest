// Build-time Supabase reads must never block a deploy.
//
// The build reads public_properties three times (vite.config.ts → landing
// index + listing JSON-LD, scripts/prerender.mjs → listing pages,
// scripts/generate-sitemap.mjs → sitemap). If the database is down or slow,
// those steps skip their database-driven output with a loud warning and the
// build still succeeds: the static routes and the SPA deploy as normal,
// /property/<id> and /cottages/<slug> fall back to index.html (the app renders
// them client-side), and public/sitemap.xml is served. The next healthy build
// (the nightly Deploy Hook at the latest) restores everything.

/** How long one build-time query may take before it is treated as down. */
export const BUILD_QUERY_TIMEOUT_MS = Number(process.env.BUILD_SUPABASE_TIMEOUT_MS) || 30000;

/** Abort signal for one build-time query. */
export function buildQuerySignal() {
  return AbortSignal.timeout(BUILD_QUERY_TIMEOUT_MS);
}

/** One clearly visible warning line for a skipped, database-driven build step. */
export function warnDegraded(step, err) {
  const reason = String(err?.message ?? err ?? 'unknown error').split('\n')[0].slice(0, 200);
  console.warn(
    `\n⚠⚠ BUILD DEGRADED — ${step} skipped: Supabase unreachable (${reason}).` +
      '\n   Deploying without it; the next healthy build restores it.\n',
  );
}
