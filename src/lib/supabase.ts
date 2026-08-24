import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * The URL fragment exactly as the browser was opened with it.
 *
 * MUST be read before createClient() below: with `detectSessionInUrl` on,
 * supabase-js consumes the recovery/OAuth tokens out of the hash and then
 * strips it from the address bar. Anything reading window.location.hash after
 * that races the SDK and usually loses — which is what made password-reset
 * links look "expired" at random (see pages/auth-reset-password).
 */
export const initialUrlHash = typeof window !== 'undefined' ? window.location.hash : '';

/**
 * The access token already in storage at page load, before the SDK touched it.
 * Captured for the same reason and at the same moment as `initialUrlHash`.
 *
 * Lets a page tell "the session I'm holding was just minted from the link in
 * this URL" apart from "I was already logged in and the link did nothing" —
 * the distinction that decides whether a password reset can actually succeed.
 */
export const initialStoredAccessToken: string | null = (() => {
  if (typeof window === 'undefined') return null;
  try {
    // supabase-js keys its storage by project ref, the first label of the host.
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    return raw ? (JSON.parse(raw)?.access_token ?? null) : null;
  } catch {
    return null;
  }
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export interface Booking {
  id: string;
  user_email: string;
  user_name: string | null;
  property_id: string | null;
  property_title: string;
  property_location: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  price_per_night: number | null;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_total_price: number | null;
  date_change_status: string | null;
  date_change_requested_at: string | null;
}

export interface PropertyApplication {
  id: string;
  host_first_name: string;
  host_last_name: string;
  host_email: string;
  host_phone: string;
  property_type: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  amenities: string[];
  photo_urls: string[];
  title: string;
  description: string;
  price_per_night: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_token: string;
  created_at: string;
}
