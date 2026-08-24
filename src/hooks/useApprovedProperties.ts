import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { listingText, type TranslatableListing } from '../lib/listingText';
import { useT } from '../i18n';
import type { Lang } from '../i18n/config';

export interface NormalizedProperty {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  host: string;
  amenities: string[];
  categories: string[];
  propertyType: string;
  isRealListing: boolean;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  coverPosition?: 'top' | 'center' | 'bottom';
}

function normalizeRow(app: Record<string, unknown>, lang: Lang): NormalizedProperty {
  // Self-hosted placeholder — the old readdy.ai fallback URL 400s (dead endpoint).
  const fallbackImage = '/cottage-placeholder.svg';
  const photoUrls: string[] =
    Array.isArray(app.photo_urls) && (app.photo_urls as string[]).length > 0
      ? (app.photo_urls as string[])
      : [fallbackImage];

  const coverUrl: string = (app.cover_photo_url as string | null) || photoUrls[0];

  let orderedPhotos: string[];
  if (coverUrl && photoUrls[0] !== coverUrl) {
    orderedPhotos = [coverUrl, ...photoUrls.filter((u: string) => u !== coverUrl)];
  } else {
    orderedPhotos = photoUrls;
  }

  const rawPosition = app.cover_photo_position as string | null;
  const coverPosition: 'top' | 'center' | 'bottom' =
    rawPosition === 'top' || rawPosition === 'bottom' ? rawPosition : 'center';

  return {
    id: app.id as string,
    // Card titles follow the reader's language when a translation exists.
    title: listingText(app as TranslatableListing, 'title', lang),
    location: app.location as string,
    price: Number(app.price_per_night),
    rating: 5.0,
    reviews: 0,
    image: coverUrl,
    images: orderedPhotos,
    host: `${(app.host_first_name as string) ?? ''} ${((app.host_last_name as string) ?? '').charAt(0)}.`.trim(),
    amenities: (app.amenities as string[]) || [],
    categories: (app.categories as string[]) || [],
    propertyType: (app.property_type as string) || 'Cottage',
    isRealListing: true,
    bedrooms: app.bedrooms as number | undefined,
    bathrooms: app.bathrooms as number | undefined,
    maxGuests: app.max_guests as number | undefined,
    coverPosition,
  };
}

/**
 * Fetches ALL approved properties in one go so the search page can apply
 * global sorting + display-slice pagination without DB-level pagination
 * interfering with sort order.
 */
export function useApprovedProperties() {
  const { lang } = useT();
  const [dbProperties, setDbProperties] = useState<NormalizedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all approved listings — no range limit so sorting is always global.
        // SECURITY: select only display-safe columns. Never ship host_email,
        // host_phone, or admin_token to the public client (was select('*')).
        // The translation columns are added by a separate DB migration, while the
        // frontend deploys on its own schedule — so there is always a window
        // where one is ahead of the other. Asking for a column that doesn't
        // exist yet fails the WHOLE query (PostgREST 42703), which would empty
        // the site. Ask for them, and fall back to the base set if they're not
        // there yet.
        const BASE_COLUMNS =
          'id, title, location, price_per_night, host_first_name, host_last_name, amenities, categories, property_type, bedrooms, bathrooms, max_guests, photo_urls, cover_photo_url, cover_photo_position';
        const TRANSLATION_COLUMNS = 'title_en, title_ru, source_lang';

        const runQuery = (columns: string) =>
          supabase
            .from('property_applications')
            .select(columns)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .returns<Record<string, unknown>[]>();

        let { data, error: fetchError } = await runQuery(`${BASE_COLUMNS}, ${TRANSLATION_COLUMNS}`);

        if (fetchError?.code === '42703') {
          ({ data, error: fetchError } = await runQuery(BASE_COLUMNS));
        }

        if (fetchError) {
          console.error('[useApprovedProperties] Fetch error:', fetchError.message);
          setError(fetchError.message);
          return;
        }

        setDbProperties((data || []).map((row) => normalizeRow(row, lang)));
      } catch (e) {
        console.error('[useApprovedProperties] Unexpected error:', e);
        setError('Failed to load listings');
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
    // Re-resolve titles when the reader switches language.
  }, [lang]);

  return {
    dbProperties,
    loading,
    error,
    // Legacy fields kept for compatibility — no longer used for DB pagination
    loadingMore: false,
    hasMore: false,
    loadMore: () => {},
    totalCount: null as number | null,
  };
}
