import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

function normalizeRow(app: Record<string, unknown>): NormalizedProperty {
  const fallbackImage =
    'https://readdy.ai/api/search-image?query=Beautiful%20traditional%20Georgian%20cottage%20surrounded%20by%20lush%20green%20mountains%20and%20nature%2C%20warm%20cozy%20atmosphere%2C%20natural%20lighting%2C%20rustic%20charm&width=400&height=300&seq=default-cottage-db&orientation=landscape';
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
    title: app.title as string,
    location: app.location as string,
    price: Number(app.price_per_night),
    rating: 5.0,
    reviews: 0,
    image: coverUrl,
    images: orderedPhotos,
    host: `${app.host_first_name as string} ${(app.host_last_name as string).charAt(0)}.`,
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
        const { data, error: fetchError } = await supabase
          .from('property_applications')
          .select(
            'id, title, location, price_per_night, host_first_name, host_last_name, amenities, categories, property_type, bedrooms, bathrooms, max_guests, photo_urls, cover_photo_url, cover_photo_position'
          )
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('[useApprovedProperties] Fetch error:', fetchError.message);
          setError(fetchError.message);
          return;
        }

        setDbProperties((data || []).map(normalizeRow));
      } catch (e) {
        console.error('[useApprovedProperties] Unexpected error:', e);
        setError('Failed to load listings');
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

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
