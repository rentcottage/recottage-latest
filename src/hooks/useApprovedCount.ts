import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Live count of approved (publicly bookable) listings.
 *
 * Uses a HEAD `count: 'exact'` query so NO rows are transferred — Postgres
 * returns just the number. Marketing copy across the site used a hardcoded
 * "500+"; this replaces that guess with the real figure and keeps it honest as
 * hosts are added/removed.
 *
 * Returns `null` until the count is known (and on any error) so callers can
 * render neutral fallback copy — never a fabricated number.
 */
export function useApprovedCount(): { count: number | null; loading: boolean } {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      const { count: c, error } = await supabase
        .from('property_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      if (cancelled) return;
      if (!error && typeof c === 'number') setCount(c);
      setLoading(false);
    }
    fetchCount();
    return () => {
      cancelled = true;
    };
  }, []);

  return { count, loading };
}
