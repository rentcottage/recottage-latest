import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import PropertyReviews from './components/PropertyReviews';
import PropertyGallery from './components/PropertyGallery';
import BookingWidget from './components/BookingWidget';
import SEO from '../../components/feature/SEO';
import { supabase } from '../../lib/supabase';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, findPromoForLocation, applyPromoDiscount, type Promo } from '../../lib/promos';

const BOOKING_FN_URL = 'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/bog-payment?action=create-order';

interface BlockedRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
}

interface ICalBlockedRange {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  platform: string | null;
  summary: string | null;
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [property, setProperty] = useState<any>(null);
  const [isDbProperty, setIsDbProperty] = useState(false);
  const [pricingType, setPricingType] = useState<'fixed' | 'per_guest'>('fixed');
  const [guestPricingTiers, setGuestPricingTiers] = useState<Array<{ min_guests: number; max_guests: number; price_per_night: number }>>([]);
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
  const [icalBlockedRanges, setIcalBlockedRanges] = useState<ICalBlockedRange[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error' | 'unauthenticated'>('idle');
  const [bookingError, setBookingError] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_now' | 'pay_at_property'>('pay_at_property');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [bookingCaptchaToken, setBookingCaptchaToken] = useState('');
  const [corporateId, setCorporateId] = useState<string | null>(null);
  const [corporateClientName, setCorporateClientName] = useState('');
  const [activePromo, setActivePromo] = useState<Promo | null>(null);

  // Location-targeted promo — dormant until FEATURE_FLAGS.ENABLE_PROMOS is on.
  // The server (bog-payment) independently verifies and applies the same promo,
  // so this only controls what the guest sees.
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_PROMOS || !property?.location) { setActivePromo(null); return; }
    let cancelled = false;
    fetchActivePromos().then((promos) => {
      if (!cancelled) setActivePromo(findPromoForLocation(promos, property.location));
    });
    return () => { cancelled = true; };
  }, [property?.location]);

  // Detect whether the signed-in user is an approved travel agency.
  useEffect(() => {
    let cancelled = false;
    async function detectCorporate() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (!cancelled) setCorporateId(null); return; }
      const { data } = await supabase
        .from('corporate_applications')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'approved')
        .maybeSingle();
      if (!cancelled) setCorporateId(data?.id ?? null);
    }
    detectCorporate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => detectCorporate());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    async function loadProperty() {
      const { data: app, error } = await supabase
        .from('property_applications')
        // SECURITY: explicit display-safe columns only — never expose
        // host_email, host_phone, or admin_token to the public client.
        .select(
          'id, title, location, price_per_night, cover_photo_url, cover_photo_position, amenities, categories, description, bedrooms, bathrooms, max_guests, google_maps_url, latitude, longitude, address, accepted_payment_methods, pricing_type, guest_pricing_tiers, host_first_name, host_last_name, photo_urls'
        )
        .eq('id', id)
        .eq('status', 'approved')
        .maybeSingle();

      if (error || !app) {
        navigate('/');
        return;
      }

      const hostName = `${app.host_first_name} ${app.host_last_name.charAt(0)}.`;
      const photos: string[] =
        app.photo_urls?.length > 0
          ? app.photo_urls
          : ['/cottage-placeholder.svg']; // self-hosted; old readdy.ai fallback 400s

      setProperty({
        id: app.id,
        title: app.title,
        location: app.location,
        price: Number(app.price_per_night),
        rating: 5.0,
        reviews: 0,
        image: (app.cover_photo_url as string | null) || photos[0],
        images: (app.cover_photo_url && photos[0] !== app.cover_photo_url)
          ? [app.cover_photo_url, ...photos.filter((u: string) => u !== app.cover_photo_url)]
          : photos,
        host: hostName,
        amenities: app.amenities || [],
        description: app.description,
        bedrooms: app.bedrooms,
        bathrooms: app.bathrooms,
        maxGuests: app.max_guests,
        google_maps_url: app.google_maps_url || null,
        latitude: app.latitude ?? null,
        longitude: app.longitude ?? null,
        address: app.address || null,
        accepted_payment_methods: app.accepted_payment_methods || 'both',
      });
      // Default payment method to whichever the property accepts.
      const acceptedPm = app.accepted_payment_methods || 'both';
      if (acceptedPm === 'online_only') setPaymentMethod('pay_now');
      else setPaymentMethod('pay_at_property');
      setPricingType((app.pricing_type as 'fixed' | 'per_guest') || 'fixed');
      setGuestPricingTiers(app.guest_pricing_tiers || []);
      setIsDbProperty(true);

      const urlCheckIn = searchParams.get('checkIn');
      const urlCheckOut = searchParams.get('checkOut');
      const urlGuests = searchParams.get('guests');
      if (urlCheckIn) setCheckIn(urlCheckIn);
      if (urlCheckOut) setCheckOut(urlCheckOut);
      if (urlGuests) {
        const maxG = app.max_guests ?? 20;
        const clamped = Math.min(parseInt(urlGuests) || 1, maxG);
        setGuests(String(clamped));
      } else {
        // Default to 1 guest (safe default)
        setGuests('1');
      }
    }

    loadProperty();
  }, [id, navigate, searchParams]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('blocked_dates')
      .select('id, property_id, start_date, end_date')
      .eq('property_id', id)
      .then(({ data }) => {
        if (data) setBlockedRanges(data as BlockedRange[]);
      });

    supabase
      .from('ical_blocked_dates')
      .select('id, property_id, start_date, end_date, platform, summary')
      .eq('property_id', id)
      .then(({ data }) => {
        if (data) setIcalBlockedRanges(data as ICalBlockedRange[]);
      });
  }, [id]);

  const isDateRangeBlocked = useCallback((start: string, end: string): boolean => {
    if (!start || !end) return false;
    const manualBlocked = blockedRanges.some((r) => !(end < r.start_date || start > r.end_date));
    const icalBlocked = icalBlockedRanges.some((r) => !(end < r.start_date || start > r.end_date));
    return manualBlocked || icalBlocked;
  }, [blockedRanges, icalBlockedRanges]);

  const getICalConflictPlatforms = useCallback((start: string, end: string): string[] => {
    if (!start || !end) return [];
    const platforms = new Set<string>();
    icalBlockedRanges.forEach((r) => {
      if (!(end < r.start_date || start > r.end_date)) {
        platforms.add(r.platform ?? 'External');
      }
    });
    return Array.from(platforms);
  }, [icalBlockedRanges]);

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPriceForGuests = (guestCount: number): number => {
    if (!property) return 0;
    if (pricingType === 'per_guest' && guestPricingTiers.length > 0) {
      const tier = guestPricingTiers.find(
        (t) => guestCount >= t.min_guests && guestCount <= t.max_guests
      );
      if (tier) return tier.price_per_night;
      // Fallback: use last tier if guest count exceeds all tiers
      const lastTier = guestPricingTiers[guestPricingTiers.length - 1];
      if (lastTier) return lastTier.price_per_night;
    }
    return property.price;
  };

  const currentPricePerNight = getPriceForGuests(parseInt(guests) || 1);
  const getBaseTotalPrice = () => calculateNights() * currentPricePerNight;
  // Promo discount — same formula as the server so the charged amount matches.
  const getTotalPrice = () => activePromo
    ? applyPromoDiscount(getBaseTotalPrice(), activePromo.discount_percent)
    : getBaseTotalPrice();

  const handleBackClick = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleShare = async () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';
    const shareUrl = `${siteUrl}/property/${id}`;
    const shareData = {
      title: property?.title ?? 'Georgian Cottage',
      text: `Check out this cottage in ${property?.location ?? 'Georgia'} on RentCottage.Ge!`,
      url: shareUrl,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        // fallback: select text
      }
    }
  };

  const handleBooking = async () => {
    if (isSubmitting) return;

    if (!bookingCaptchaToken) {
      setSubmitStatus('error');
      setBookingError('Please complete the CAPTCHA verification.');
      return;
    }

    if (!checkIn || !checkOut || !guests) { setSubmitStatus('error'); setBookingError('Please fill in all dates and guest count.'); return; }
    const nights = calculateNights();
    if (nights <= 0) { setSubmitStatus('error'); setBookingError('Check-out must be after check-in.'); return; }

    if (isDateRangeBlocked(checkIn, checkOut)) {
      setSubmitStatus('error');
      setBookingError('The selected dates are unavailable. Please choose different dates.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSubmitStatus('unauthenticated');
      return;
    }

    // Check if user has a phone number saved — required before booking
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', session.user.id)
      .maybeSingle();

    const hasPhone = profile?.phone && profile.phone.trim().length > 0;
    if (!hasPhone) {
      setSubmitStatus('error');
      setBookingError('Please add a phone number to your profile before making a booking. Go to My Profile to complete your account.');
      return;
    }

    const user = session.user;
    const meta = user.user_metadata ?? {};
    const ownName = meta.full_name ?? meta.name ?? `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim();
    const trimmedClientName = corporateClientName.trim();
    // Agencies stamp the booking with the client's name; their own email stays so confirmations land with them.
    const fullName = corporateId && trimmedClientName ? trimmedClientName : ownName;
    const email = user.email ?? '';

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setBookingError('');

    try {
      const response = await fetch(BOOKING_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({
          user_email: email,
          user_name: fullName,
          customer_id: user.id,
          property_id: property.id,
          property_title: property.title,
          property_location: property.location,
          check_in: checkIn,
          check_out: checkOut,
          guests: parseInt(guests),
          price_per_night: currentPricePerNight,
          total_price: getTotalPrice(),
          payment_method: paymentMethod,
          captcha_token: bookingCaptchaToken,
          corporate_id: corporateId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.payAtProperty) {
          setSubmitStatus('success');
          setBookingCaptchaToken('');
        } else if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          const msg = `Payment system returned no redirect URL. Response: ${JSON.stringify(data)}`;
          console.error('[handleBooking]', msg);
          setBookingError('Payment system error: no checkout URL returned. Please try again.');
          setSubmitStatus('error');
          setBookingCaptchaToken('');
        }
      } else {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errMsg = errData.error ?? errMsg;
        } catch {
          try { errMsg = await response.text(); } catch { /* ignore */ }
        }
        console.error('[handleBooking] Backend error:', errMsg);
        setBookingError(errMsg);
        setSubmitStatus('error');
        setBookingCaptchaToken('');
      }
    } catch (err) {
      const msg = `Network error: ${String(err)}`;
      console.error('[handleBooking]', msg);
      setBookingError('Network error. Please check your connection and try again.');
      setSubmitStatus('error');
      setBookingCaptchaToken('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!property) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 flex items-center justify-center animate-spin">
            <i className="ri-loader-4-line text-xl"></i>
          </div>
          <span className="text-sm">Loading property...</span>
        </div>
      </div>
    );
  }

  // Helper: build embed src for Google Maps
  const getMapEmbedSrc = (): string | null => {
    if (!property) return null;
    if (property.latitude != null && property.longitude != null) {
      return `https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`;
    }
    return null;
  };

  const getMapViewUrl = (): string | null => {
    if (!property) return null;
    if (property.google_maps_url) return property.google_maps_url;
    if (property.latitude != null && property.longitude != null) {
      return `https://www.google.com/maps?q=${property.latitude},${property.longitude}`;
    }
    return null;
  };

  const hasLocation = property && (
    property.google_maps_url ||
    (property.latitude != null && property.longitude != null) ||
    property.address
  );

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';
  const propertyJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.title,
    description: property.description || `Authentic Georgian cottage rental in ${property.location}. ${property.bedrooms || 1} bedrooms, perfect for your Georgian getaway.`,
    url: `${siteUrl}/property/${property.id}`,
    image: property.image,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.location,
      addressCountry: 'GE',
    },
    ...(property.latitude != null && property.longitude != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: property.latitude, longitude: property.longitude } }
      : {}),
    aggregateRating:
      property.reviews > 0
        ? { '@type': 'AggregateRating', ratingValue: property.rating, reviewCount: property.reviews }
        : undefined,
    priceRange: `₾${property.price} per night`,
    amenityFeature: (property.amenities || []).map((a: string) => ({
      '@type': 'LocationFeatureSpecification',
      name: a,
      value: true,
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${property.title} — ${property.location} Cottage Rental | RentCottage.Ge`}
        description={`Book ${property.title} in ${property.location}, Georgia. ₾${property.price}/night · ${property.bedrooms || 1} bedrooms · Rating ${property.rating}. Authentic Georgian cottage experience with verified host.`}
        keywords={`${property.location} cottage rental, Georgian cottage ${property.location}, rent cottage Georgia`}
        canonical={`/property/${property.id}`}
        ogType="product"
        ogImage={property.image}
        jsonLd={propertyJsonLd}
      />
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-4 md:py-8 pb-24 lg:pb-8">
        {/* Back Button */}
        <button
          onClick={handleBackClick}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 md:mb-6 cursor-pointer whitespace-nowrap"
        >
          <div className="w-5 h-5 flex items-center justify-center mr-2">
            <i className="ri-arrow-left-line"></i>
          </div>
          Back to listings
        </button>

        {/* Property Title and Location */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-2">
            <h1 className="text-lg md:text-3xl font-bold text-gray-900 min-w-0 flex-1 notranslate" translate="no">{property.title}</h1>
            {/* Share Button */}
            <div className="flex-shrink-0">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-2.5 py-2 md:px-3 border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={shareCopied ? 'ri-check-line text-green-500' : 'ri-share-line'}></i>
                </div>
                <span className={`hidden sm:inline ${shareCopied ? 'text-green-600' : ''}`}>
                  {shareCopied ? 'Copied!' : 'Share'}
                </span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            <div className="flex items-center">
              <div className="w-4 h-4 flex items-center justify-center mr-1">
                <i className="ri-map-pin-line"></i>
              </div>
              <span>{property.location}</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 flex items-center justify-center mr-1">
                <i className="ri-star-fill text-yellow-400"></i>
              </div>
              <span className="font-medium">{property.rating}</span>
              <span className="ml-1">({property.reviews} reviews)</span>
            </div>
          </div>
        </div>

        {/* Photo Gallery — main image + thumbnail strip + lightbox */}
        <PropertyGallery images={property.images} title={property.title} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Property Details */}
          <div className="lg:col-span-2">
            {/* Host Info */}
            <div className="border-b border-gray-200 pb-4 mb-4 md:pb-6 md:mb-6">
              <h2 className="text-sm md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Hosted by {property.host}</h2>
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-full flex items-center justify-center mr-3 md:mr-4">
                  <i className="ri-user-line text-gray-500 text-lg md:text-xl"></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm md:text-base">{property.host}</p>
                  <p className="text-xs text-gray-600">Superhost · 3 years hosting</p>
                </div>
              </div>
            </div>

            {/* About this place — full description */}
            <div className="border-b border-gray-200 pb-4 mb-4 md:pb-6 md:mb-6">
              <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">About this place</h3>
              {(() => {
                const fullText = property.description
                  ? property.description
                  : `Experience authentic Georgian hospitality in this beautifully restored ${property.title.toLowerCase()}. Located in the heart of ${property.location}, this charming property offers stunning views and easy access to local attractions. The space features traditional Georgian architecture combined with modern amenities for your comfort. Perfect for couples, families, or small groups looking to explore the beauty of Georgia while enjoying a peaceful retreat. Your host ${property.host} is a local expert who can provide insider tips on the best restaurants, hiking trails, and cultural experiences in the area.`;
                const PREVIEW_LENGTH = 400;
                const isLong = fullText.length > PREVIEW_LENGTH;
                const displayText = !showFullDesc && isLong ? `${fullText.slice(0, PREVIEW_LENGTH).trimEnd()}…` : fullText;
                return (
                  <>
                    <p className="text-xs md:text-sm text-gray-700 leading-relaxed whitespace-pre-line">{displayText}</p>
                    {isLong && (
                      <button
                        onClick={() => setShowFullDesc((v) => !v)}
                        className="mt-3 flex items-center gap-1 text-xs md:text-sm font-semibold text-gray-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                      >
                        {showFullDesc ? 'Show less' : 'Show more'}
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={`${showFullDesc ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-base`}></i>
                        </div>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* What this place offers — amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="border-b border-gray-200 pb-4 mb-4 md:pb-6 md:mb-6">
                <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">What this place offers</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {property.amenities.map((amenity: string) => (
                    <div key={amenity} className="flex items-center gap-2 text-xs md:text-sm text-gray-700">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <i className={`${
                          amenity === 'WiFi' ? 'ri-wifi-line' :
                          amenity === 'Kitchen' ? 'ri-restaurant-line' :
                          amenity === 'Fireplace' ? 'ri-fire-line' :
                          amenity === 'Swimming Pool' ? 'ri-water-flash-line' :
                          amenity === 'Parking' ? 'ri-parking-line' :
                          amenity === 'Hot Tub' ? 'ri-drop-line' :
                          amenity === 'Mountain View' ? 'ri-landscape-line' :
                          amenity === 'Lake Access' ? 'ri-water-flash-line' :
                          amenity === 'BBQ Grill' ? 'ri-fire-fill' :
                          amenity === 'Pet Friendly' ? 'ri-bear-smile-line' :
                          amenity === 'Heating' ? 'ri-temp-hot-line' :
                          amenity === 'Air Conditioning' ? 'ri-temp-cold-line' :
                          'ri-checkbox-circle-line'
                        } text-gray-500`}></i>
                      </div>
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location Section */}
            {hasLocation && (
              <div className="border-b border-gray-200 pb-4 mb-4 md:pb-6 md:mb-6">
                <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Where you&apos;ll be</h3>

                {/* Address text */}
                {property.address && (
                  <div className="flex items-start gap-2 mb-3">
                    <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <i className="ri-map-pin-2-line text-gray-500 text-sm"></i>
                    </div>
                    <p className="text-sm text-gray-700">{property.address}</p>
                  </div>
                )}

                {/* Embedded map */}
                {getMapEmbedSrc() && (
                  <div className="w-full h-64 md:h-80 rounded-xl overflow-hidden border border-gray-200 mb-3">
                    <iframe
                      title="Property location map"
                      src={getMapEmbedSrc()!}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}

                {/* View on Google Maps button */}
                {getMapViewUrl() && (
                  <a
                    href={getMapViewUrl()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-map-2-line text-red-500"></i>
                    </div>
                    View on Google Maps
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-external-link-line text-gray-400 text-xs"></i>
                    </div>
                  </a>
                )}
              </div>
            )}

            {/* Per-guest pricing breakdown — fully interactive selector */}
            {pricingType === 'per_guest' && guestPricingTiers.length > 0 && (
              <div className="border-b border-gray-200 pb-4 mb-4 md:pb-6 md:mb-6">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-sm md:text-xl font-semibold text-gray-900">Pricing by Guest Count</h3>
                  <span className="text-xs text-gray-400">Tap to select</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {guestPricingTiers.map((tier, idx) => {
                    const guestCount = parseInt(guests) || 1;
                    const isActive = guestCount >= tier.min_guests && guestCount <= tier.max_guests;
                    const selectValue = tier.min_guests === tier.max_guests
                      ? tier.min_guests
                      : tier.min_guests;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setGuests(String(selectValue))}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-400 ${
                          isActive
                            ? 'border-red-400 bg-red-50 font-semibold ring-1 ring-red-300'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                        }`}
                        aria-pressed={isActive}
                        aria-label={`Select ${tier.min_guests === tier.max_guests ? `${tier.min_guests} guest${tier.min_guests > 1 ? 's' : ''}` : `${tier.min_guests} to ${tier.max_guests} guests`} at ₾${tier.price_per_night} per night`}
                      >
                        <span className={`flex items-center gap-1 ${isActive ? 'text-red-700' : ''}`}>
                          <i className="ri-user-line text-xs"></i>
                          {tier.min_guests === tier.max_guests
                            ? `${tier.min_guests} guest${tier.min_guests > 1 ? 's' : ''}`
                            : `${tier.min_guests}–${tier.max_guests}`}
                        </span>
                        <span className={`font-semibold ${isActive ? 'text-red-700' : 'text-gray-700'}`}>₾{tier.price_per_night}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <i className="ri-information-line"></i>
                  Selecting a tier updates guest count and price in the booking form below.
                </p>
              </div>
            )}

            {/* Reviews */}
            <div className="mb-4 md:mb-6">
              <PropertyReviews propertyId={property.id} isDbProperty={isDbProperty} />
            </div>
          </div>

          {/* Booking Widget — desktop sidebar + mobile bottom sheet */}
          <div className="lg:col-span-1">
            <BookingWidget
              property={property}
              pricingType={pricingType}
              guestPricingTiers={guestPricingTiers}
              blockedRanges={blockedRanges}
              icalBlockedRanges={icalBlockedRanges}
              checkIn={checkIn}
              checkOut={checkOut}
              guests={guests}
              onCheckInChange={setCheckIn}
              onCheckOutChange={setCheckOut}
              onGuestsChange={setGuests}
              isSubmitting={isSubmitting}
              submitStatus={submitStatus}
              bookingError={bookingError}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              onBook={handleBooking}
              isDateRangeBlocked={isDateRangeBlocked}
              getICalConflictPlatforms={getICalConflictPlatforms}
              currentPricePerNight={currentPricePerNight}
              calculateNights={calculateNights}
              getTotalPrice={getTotalPrice}
              activePromo={activePromo}
              onCaptchaVerify={(token) => setBookingCaptchaToken(token)}
              onCaptchaExpire={() => setBookingCaptchaToken('')}
              captchaToken={bookingCaptchaToken}
              corporateMode={!!corporateId}
              corporateClientName={corporateClientName}
              onCorporateClientNameChange={setCorporateClientName}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Support</h3>
              <ul className="space-y-1 md:space-y-2">
                <li>
                  <button onClick={() => setShowCancellationModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left">
                    Cancellation Options
                  </button>
                </li>
                <li>
                  <button onClick={() => setShowContactModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left">
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Community</h3>
              <ul className="space-y-1 md:space-y-2">
                <li><a href="/become-host" className="text-xs md:text-sm text-gray-300 hover:text-white">Become a Host</a></li>
                <li><a href="/host-resources" className="text-xs md:text-sm text-gray-300 hover:text-white">Host Resources</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">About</h3>
              <ul className="space-y-1 md:space-y-2">
                <li><a href="/how-it-works" className="text-xs md:text-sm text-gray-300 hover:text-white">How it Works</a></li>
                <li><a href="/about-georgia" className="text-xs md:text-sm text-gray-300 hover:text-white">About Georgia</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a href="https://www.facebook.com/profile.php?id=61583084123461" target="_blank" rel="noopener noreferrer" className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white">
                  <i className="ri-facebook-line text-sm md:text-base"></i>
                </a>
                <a href="https://www.instagram.com/rentcottage.ge/" target="_blank" rel="noopener noreferrer" className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white">
                  <i className="ri-instagram-line text-sm md:text-base"></i>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-4 md:pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 md:mb-0">
              <h1 className="text-sm md:text-xl font-semibold md:font-bold text-red-500" style={{ fontFamily: '"Pacifico", serif' }}>
                RentCottage.Ge
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <a href="/privacy" className="text-xs md:text-sm text-gray-300 hover:text-white">Privacy</a>
                <a href="/terms" className="text-xs md:text-sm text-gray-300 hover:text-white">Terms &amp; Conditions</a>
                <a href="/sitemap" className="text-xs md:text-sm text-gray-300 hover:text-white">Site Map</a>
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-400">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
      {showCancellationModal && (
        <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />
      )}
    </div>
  );
}
