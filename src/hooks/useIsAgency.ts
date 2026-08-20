import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * True when the signed-in user owns an APPROVED travel-agency account.
 *
 * Agencies book on behalf of clients — they never host — so the host-facing
 * parts of the UI are hidden from them and "My Profile" points at the agency
 * dashboard instead. Pending or rejected agencies are treated as normal users.
 *
 * ⚠️ Never call supabase.auth.* inside the onAuthStateChange callback. That
 * callback runs while supabase-js holds the auth lock (Web Locks API), so an
 * awaited auth call inside it deadlocks — getSession() then never resolves for
 * ANYONE on the page, which strands every `loading` flag in the app. The
 * callback already hands us the session; use it, and defer any follow-up query
 * out of the callback with a 0ms timeout so the lock is released first.
 */
export function useIsAgency(): { isAgency: boolean; loading: boolean } {
  const [isAgency, setIsAgency] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detectFor(userId: string | null) {
      if (!userId) {
        if (!cancelled) { setIsAgency(false); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('corporate_applications')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .maybeSingle();
      if (!cancelled) { setIsAgency(!!data); setLoading(false); }
    }

    // One initial read, outside any auth callback.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) detectFor(session?.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      // Deferred: releases the auth lock before the query runs.
      setTimeout(() => { if (!cancelled) detectFor(userId); }, 0);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { isAgency, loading };
}
