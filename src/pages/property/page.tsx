import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import PropertyReviews from './components/PropertyReviews';
import PropertyGallery from './components/PropertyGallery';
import BookingWidget from './components/BookingWidget';
import SEO from '../../components/feature/SEO';
import { supabase } from '../../lib/supabase';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import { fetchActivePromos, findPromoForLocation, applyPromoDiscount, type Promo } from '../../lib/promos';
import { useTranslation, translateVocab } from '@lib/i18n';

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
  const { t } = useTranslation();
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
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [saved, setSaved] = useState(false); // decorative only — no favorites backend
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

      const hostName = `${app.host_first_name ?? ''} ${(app.host_last_name ?? '').charAt(0)}.`.trim();
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
        platforms.add(r.platform ?? t('property.externalPlatform'));
      }
    });
    return Array.from(platforms);
  }, [icalBlockedRanges, t]);

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    // Signed diff (no Math.abs): reversed/equal ranges yield <= 0 nights, which the booking guard rejects.
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

  // Clear check-out when it's on/before the new check-in (YYYY-MM-DD sorts as date order) to prevent reversed ranges.
  const handleCheckInChange = useCallback((v: string) => {
    setCheckIn(v);
    setCheckOut((prev) => (prev && prev <= v ? '' : prev));
  }, []);

  const handleBackClick = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleShare = async () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';
    const shareUrl = `${siteUrl}/property/${id}`;
    const shareData = {
      title: property?.title ?? t('property.shareTitleFallback'),
      text: t('property.shareText', { location: property?.location ?? t('property.shareLocationFallback') }),
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
      setBookingError(t('property.errors.captcha'));
      return;
    }

    if (!checkIn || !checkOut || !guests) { setSubmitStatus('error'); setBookingError(t('property.errors.fillDates')); return; }
    const nights = calculateNights();
    if (nights <= 0) { setSubmitStatus('error'); setBookingError(t('property.errors.checkoutAfterCheckin')); return; }

    if (isDateRangeBlocked(checkIn, checkOut)) {
      setSubmitStatus('error');
      setBookingError(t('property.errors.datesUnavailable'));
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
      setBookingError(t('property.errors.phoneRequired'));
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
          setBookingError(t('property.errors.paymentNoUrl'));
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
      setBookingError(t('property.errors.network'));
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
          <span className="text-sm">{t('property.loading')}</span>
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
        title={t('property.seo.title', { title: property.title, location: property.location })}
        description={t('property.seo.description', { title: property.title, location: property.location, price: property.price, bedrooms: property.bedrooms || 1, rating: property.rating })}
        keywords={t('property.seo.keywords', { location: property.location })}
        canonical={`/property/${property.id}`}
        ogType="product"
        ogImage={property.image}
        jsonLd={propertyJsonLd}
      />
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 md:py-6 pb-24 lg:pb-8">
        {/* Breadcrumb — back to results */}
        <button
          onClick={handleBackClick}
          className="inline-flex items-center gap-1 text-sm font-semibold text-red-500 hover:text-red-600 mb-3 md:mb-4 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line"></i>
          {t('property.backToResults')}
        </button>

        {/* Property Title Row */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4 md:mb-5">
          <div className="min-w-0">
            <h1 className="text-xl md:text-[32px] font-extrabold text-ink tracking-tight leading-tight notranslate" translate="no">{property.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-2 text-[14.5px] text-gray-700">
              <span className="inline-flex items-center gap-1">
                <i className="ri-map-pin-line text-soft"></i>
                {property.location}
              </span>
              <span className="inline-flex items-center gap-1 font-bold">
                <i className="ri-star-fill text-red-500"></i>
                <span translate="no">{property.rating}</span>
                <span className="font-semibold text-soft">({t('common.reviews', { count: property.reviews })})</span>
              </span>
              {isDbProperty && (
                <span className="inline-flex items-center gap-1 bg-[#222] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  <i className="ri-verified-badge-fill"></i>
                  {t('property.verified')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 border-[1.5px] border-line hover:border-red-500 hover:text-red-500 bg-white text-gray-700 text-[13.5px] font-bold rounded-full px-4 py-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className={shareCopied ? 'ri-check-line text-green-500' : 'ri-share-line'}></i>
              <span className={shareCopied ? 'text-green-600' : ''}>{shareCopied ? t('property.copied') : t('property.share')}</span>
            </button>
            {/* Decorative save — no favorites backend today */}
            <button
              onClick={() => setSaved((v) => !v)}
              aria-pressed={saved}
              className="inline-flex items-center gap-1.5 border-[1.5px] border-line hover:border-red-500 hover:text-red-500 bg-white text-gray-700 text-[13.5px] font-bold rounded-full px-4 py-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className={saved ? 'ri-heart-fill text-red-500' : 'ri-heart-line'}></i>
              <span>{t('common.save')}</span>
            </button>
          </div>
        </div>

        {/* Photo Gallery — main image + thumbnail strip + lightbox */}
        <PropertyGallery images={property.images} title={property.title} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Property Details */}
          <div className="lg:col-span-2">
            {/* Host Info */}
            <div className="flex items-center gap-3.5 border-b border-line pb-5 mb-5 md:pb-6 md:mb-6">
              <div className="w-12 h-12 md:w-[52px] md:h-[52px] rounded-full bg-red-50 text-red-500 font-extrabold text-lg md:text-xl flex items-center justify-center flex-shrink-0 notranslate" translate="no">
                {property.host?.trim()?.charAt(0)?.toUpperCase() || 'H'}
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-ink truncate">{t('property.hostedBy', { host: property.host })}</h2>
                <p className="text-[13.5px] text-soft">{t('property.superhostTenure')}</p>
              </div>
              <span className="ml-auto flex-shrink-0 bg-red-50 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                <i className="ri-star-fill"></i>
                {t('property.superhost')}
              </span>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-line pb-5 mb-5 md:pb-6 md:mb-6">
              {[
                { icon: 'ri-group-line', label: t('common.guests', { count: property.maxGuests || 1 }), sub: t('property.factGuestsSub') },
                { icon: 'ri-hotel-bed-line', label: t('common.bedrooms', { count: property.bedrooms || 1 }), sub: t('property.factBedroomsSub') },
                { icon: 'ri-drop-line', label: t('common.bathrooms', { count: property.bathrooms || 1 }), sub: t('property.factBathroomsSub') },
                { icon: 'ri-verified-badge-line', label: t('property.verified'), sub: t('property.factVerifiedSub') },
              ].map((fact) => (
                <div key={fact.label} className="bg-[#fafafa] border border-line rounded-xl p-3.5 text-center">
                  <i className={`${fact.icon} text-xl text-ink`}></i>
                  <b className="block text-sm text-ink mt-1">{fact.label}</b>
                  <small className="text-xs text-soft">{fact.sub}</small>
                </div>
              ))}
            </div>

            {/* About this place — full description */}
            <div className="border-b border-line pb-5 mb-5 md:pb-6 md:mb-6">
              <h3 className="text-xl font-extrabold text-ink mb-3.5">{t('property.aboutTitle')}</h3>
              {(() => {
                const fullText = property.description
                  ? property.description
                  : t('property.descriptionFallback', { title: property.title.toLowerCase(), location: property.location, host: property.host });
                const PREVIEW_LENGTH = 400;
                const isLong = fullText.length > PREVIEW_LENGTH;
                const displayText = !showFullDesc && isLong ? `${fullText.slice(0, PREVIEW_LENGTH).trimEnd()}…` : fullText;
                return (
                  <>
                    <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-line">{displayText}</p>
                    {isLong && (
                      <button
                        onClick={() => setShowFullDesc((v) => !v)}
                        className="mt-3 flex items-center gap-1 text-sm font-bold text-red-500 hover:text-red-600 cursor-pointer whitespace-nowrap"
                      >
                        {showFullDesc ? t('common.showLess') : t('common.showMore')}
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
            {property.amenities && property.amenities.length > 0 && (() => {
              const AMENITY_PREVIEW = 8;
              const isLong = property.amenities.length > AMENITY_PREVIEW;
              const shown = showAllAmenities ? property.amenities : property.amenities.slice(0, AMENITY_PREVIEW);
              return (
              <div className="border-b border-line pb-5 mb-5 md:pb-6 md:mb-6">
                <h3 className="text-xl font-extrabold text-ink mb-3.5">{t('property.amenitiesTitle')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {shown.map((amenity: string) => (
                    <div key={amenity} className="flex items-center gap-2.5 text-[14.5px] text-gray-700">
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
                        } text-red-500`}></i>
                      </div>
                      <span>{translateVocab(t, 'amenities', amenity)}</span>
                    </div>
                  ))}
                </div>
                {isLong && (
                  <button
                    onClick={() => setShowAllAmenities((v) => !v)}
                    className="mt-3.5 inline-flex items-center gap-1 text-sm font-bold text-red-500 hover:text-red-600 cursor-pointer whitespace-nowrap"
                  >
                    {showAllAmenities ? t('common.showLess') : t('property.allAmenities', { count: property.amenities.length })}
                    <i className={showAllAmenities ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
                  </button>
                )}
              </div>
              );
            })()}

            {/* Location Section */}
            {hasLocation && (
              <div className="border-b border-line pb-5 mb-5 md:pb-6 md:mb-6">
                <h3 className="text-xl font-extrabold text-ink mb-3.5">{t('property.locationTitle')}</h3>

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
                      title={t('property.mapTitle')}
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
                    {t('property.viewOnGoogleMaps')}
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-external-link-line text-gray-400 text-xs"></i>
                    </div>
                  </a>
                )}
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
              onCheckInChange={handleCheckInChange}
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

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
