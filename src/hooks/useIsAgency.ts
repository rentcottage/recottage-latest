import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * True when the signed-in user owns an APPROVED travel-agency account.
 *
 * Agencies book on behalf of clients — they never host — so the host-facing
 * parts of the UI are hidden from them and "My Profile" points at the agency
 * dashboard instead. Pending or rejected agencies are treated as normal users.
 *
 * `loading` stays true until the answer is known, so callers can avoid
 * flashing host links at an agency on first paint.
 */
export function useIsAgency(): { isAgency: boolean; loading: boolean } {
  const [isAgency, setIsAgency] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) { setIsAgency(false); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('corporate_applications')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'approved')
        .maybeSingle();
      if (!cancelled) { setIsAgency(!!data); setLoading(false); }
    }

    detect();
    const { data: sub } = supabase.auth.onAuthStateChange(() => detect());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { isAgency, loading };
}
