import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface CottageIndexEntry {
  id: string;
  title: string;
  location: string;
}

// Module-level cache: the SearchBar mounts on several pages and the name index
// never changes within a session, so fetch it once and share it.
let cache: CottageIndexEntry[] | null = null;
let inFlight: Promise<CottageIndexEntry[]> | null = null;

async function loadIndex(): Promise<CottageIndexEntry[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // Only the three columns the name suggestions need — never widen this to
    // host contact columns (see useApprovedProperties for the same rule).
    const { data, error } = await supabase
      .from('property_applications')
      .select('id, title, location')
      .eq('status', 'approved')
      .order('title', { ascending: true });

    if (error) {
      console.error('[useCottageIndex] Fetch error:', error.message);
      inFlight = null;
      return [];
    }

    cache = (data || []).map(row => ({
      id: row.id as string,
      title: (row.title as string) || '',
      location: (row.location as string) || '',
    }));
    return cache;
  })();

  return inFlight;
}

/**
 * Names + locations of every approved listing, for cottage-name autocomplete
 * in the search bar. Loaded lazily and cached for the session.
 */
export function useCottageIndex() {
  const [cottages, setCottages] = useState<CottageIndexEntry[]>(cache || []);

  useEffect(() => {
    let active = true;
    loadIndex().then(list => {
      if (active) setCottages(list);
    });
    return () => {
      active = false;
    };
  }, []);

  return cottages;
}
