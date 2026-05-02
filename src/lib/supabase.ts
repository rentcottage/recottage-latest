import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

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
