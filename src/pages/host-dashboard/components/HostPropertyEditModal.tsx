import { useState, useEffect, useRef } from 'react';
import { useTranslation, translateVocab } from '@lib/i18n';
import { supabase } from '../../../lib/supabase';
import { compressImage } from '../../../lib/imageCompression';

interface GuestPricingTier {
  min_guests: number;
  max_guests: number;
  price_per_night: number;
}

interface Property {
  id: string;
  title: string;
  description: string;
  price_per_night: number;
  amenities: string[];
  location: string;
  property_type: string;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  booking_approval_mode?: string | null;
  accepted_payment_methods?: string | null;
  photo_urls?: string[];
  cover_photo_url?: string | null;
  cover_photo_position?: string | null;
  pricing_type?: string | null;
  guest_pricing_tiers?: GuestPricingTier[] | null;
  max_guests?: number | null;
}

interface Props {
  property: Property;
  onClose: () => void;
  onSaved: () => void;
}

const AMENITY_SUGGESTIONS = [
  'WiFi', 'Free parking', 'Air conditioning', 'Heating', 'Kitchen', 'Washing machine',
  'TV', 'BBQ grill', 'Fireplace', 'Swimming Pool', 'Hot tub', 'Balcony', 'Mountain view',
  'River view', 'Lake view', 'Pet friendly', 'Smoking allowed', 'EV charger',
  'Gym', 'Sauna', 'Security camera', 'Smoke alarm', 'First aid kit',
];

type Tab = 'settings' | 'photos';

function buildDefaultTiers(maxGuests: number): GuestPricingTier[] {
  const tiers: GuestPricingTier[] = [];
  for (let i = 1; i <= maxGuests; i++) {
    tiers.push({ min_guests: i, max_guests: i, price_per_night: 0 });
  }
  return tiers;
}

export default function HostPropertyEditModal({ property, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('settings');

  // Settings state
  const [title, setTitle] = useState(property.title || '');
  const [description, setDescription] = useState(property.description || '');
  const [price, setPrice] = useState(String(property.price_per_night || ''));
  const [amenities, setAmenities] = useState<string[]>(property.amenities || []);
  const [customAmenity, setCustomAmenity] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(property.google_maps_url || '');
  const [latitude, setLatitude] = useState(property.latitude != null ? String(property.latitude) : '');
  const [longitude, setLongitude] = useState(property.longitude != null ? String(property.longitude) : '');
  const [address, setAddress] = useState(property.address || '');
  const [approvalMode, setApprovalMode] = useState(property.booking_approval_mode || 'manual_24h');
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState(property.accepted_payment_methods || 'both');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Pricing state
  const [pricingType, setPricingType] = useState<'fixed' | 'per_guest'>(
    (property.pricing_type as 'fixed' | 'per_guest') || 'fixed'
  );
  const maxGuests = property.max_guests ?? 10;
  const [guestTiers, setGuestTiers] = useState<GuestPricingTier[]>(() => {
    if (property.guest_pricing_tiers && property.guest_pricing_tiers.length > 0) {
      return property.guest_pricing_tiers;
    }
    return buildDefaultTiers(maxGuests);
  });

  // Photo state
  const [photos, setPhotos] = useState<string[]>(property.photo_urls || []);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string>(
    property.cover_photo_url || (property.photo_urls && property.photo_urls.length > 0 ? property.photo_urls[0] : '')
  );
  const [coverPhotoPosition, setCoverPhotoPosition] = useState<'top' | 'center' | 'bottom'>(
    (property.cover_photo_position as 'top' | 'center' | 'bottom') || 'center'
  );
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(property.title || '');
    setDescription(property.description || '');
    setPrice(String(property.price_per_night || ''));
    setAmenities(property.amenities || []);
    setGoogleMapsUrl(property.google_maps_url || '');
    setLatitude(property.latitude != null ? String(property.latitude) : '');
    setLongitude(property.longitude != null ? String(property.longitude) : '');
    setAddress(property.address || '');
    setApprovalMode(property.booking_approval_mode || 'manual_24h');
    setAcceptedPaymentMethods(property.accepted_payment_methods || 'both');
    setPricingType((property.pricing_type as 'fixed' | 'per_guest') || 'fixed');
    setGuestTiers(
      property.guest_pricing_tiers && property.guest_pricing_tiers.length > 0
        ? property.guest_pricing_tiers
        : buildDefaultTiers(property.max_guests ?? 10)
    );
    setPhotos(property.photo_urls || []);
    setCoverPhotoUrl(
      property.cover_photo_url || (property.photo_urls && property.photo_urls.length > 0 ? property.photo_urls[0] : '')
    );
    setCoverPhotoPosition((property.cover_photo_position as 'top' | 'center' | 'bottom') || 'center');
    setError('');
    setSuccess(false);
    setPhotoError('');
    setPhotoSuccess(false);
  }, [property]);

  const updateTierPrice = (index: number, value: string) => {
    setGuestTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price_per_night: parseFloat(value) || 0 };
      return updated;
    });
  };

  const toggleAmenity = (a: string) => {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  };

  const addCustomAmenity = () => {
    const val = customAmenity.trim();
    if (!val || amenities.includes(val)) { setCustomAmenity(''); return; }
    setAmenities((prev) => [...prev, val]);
    setCustomAmenity('');
  };

  const removeAmenity = (a: string) => {
    setAmenities((prev) => prev.filter((x) => x !== a));
  };

  const handleSave = async () => {
    setError('');
    const priceNum = parseFloat(price);

    if (!title.trim()) { setError(t('host.editModal.errorTitleRequired')); return; }
    if (!description.trim()) { setError(t('host.editModal.errorDescriptionRequired')); return; }

    if (pricingType === 'fixed') {
      if (isNaN(priceNum) || priceNum <= 0) { setError(t('host.editModal.errorInvalidPrice')); return; }
    } else {
      const hasInvalidTier = guestTiers.some((tier) => isNaN(tier.price_per_night) || tier.price_per_night <= 0);
      if (hasInvalidTier) { setError(t('host.editModal.errorInvalidTierPrice')); return; }
    }

    const latNum = latitude.trim() ? parseFloat(latitude) : null;
    const lngNum = longitude.trim() ? parseFloat(longitude) : null;

    if ((latitude.trim() && isNaN(latNum!)) || (longitude.trim() && isNaN(lngNum!))) {
      setError(t('host.editModal.errorInvalidCoords'));
      return;
    }

    // For fixed pricing, use the entered price. For per_guest, use the first tier price as base.
    const basePriceForDb = pricingType === 'fixed'
      ? priceNum
      : (guestTiers[0]?.price_per_night ?? priceNum);

    setSaving(true);
    const { error: updateError } = await supabase
      .from('property_applications')
      .update({
        title: title.trim(),
        description: description.trim(),
        price_per_night: basePriceForDb,
        amenities,
        google_maps_url: googleMapsUrl.trim() || null,
        latitude: latNum,
        longitude: lngNum,
        address: address.trim() || null,
        booking_approval_mode: approvalMode,
        pricing_type: pricingType,
        guest_pricing_tiers: pricingType === 'per_guest' ? guestTiers : null,
        accepted_payment_methods: acceptedPaymentMethods,
      })
      .eq('id', property.id);

    if (updateError) {
      setError(t('host.editModal.errorSaveFailed'));
      setSaving(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      onSaved();
      onClose();
    }, 900);
    setSaving(false);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      setPhotoError(t('host.editModal.errorFileTooLarge'));
      return;
    }

    setUploading(true);
    setPhotoError('');

    try {
      // Re-encode to high-quality WebP before upload to save storage.
      const uploadFile = await compressImage(file);
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const fileName = `${property.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(fileName, uploadFile, { contentType: uploadFile.type, upsert: false });

      if (uploadError) {
        setPhotoError(t('host.editModal.errorUploadFailed'));
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('property-photos')
        .getPublicUrl(fileName);

      const newUrl = urlData.publicUrl;
      const updatedPhotos = [...photos, newUrl];

      const { error: dbError } = await supabase
        .from('property_applications')
        .update({ photo_urls: updatedPhotos })
        .eq('id', property.id);

      if (dbError) {
        setPhotoError(t('host.editModal.errorPhotoSaveFailed'));
        setUploading(false);
        return;
      }

      setPhotos(updatedPhotos);
      // Auto-set as cover if it's the first photo
      if (updatedPhotos.length === 1) {
        setCoverPhotoUrl(newUrl);
      }
    } catch {
      setPhotoError(t('host.editModal.errorUploadUnexpected'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetCover = async (url: string) => {
    setPhotoError('');
    setPhotoSuccess(false);
    setPhotoSaving(true);

    const { error: dbError } = await supabase
      .from('property_applications')
      .update({ cover_photo_url: url })
      .eq('id', property.id);

    if (dbError) {
      setPhotoError(t('host.editModal.errorSetCoverFailed'));
      setPhotoSaving(false);
      return;
    }

    setCoverPhotoUrl(url);
    setPhotoSuccess(true);
    setPhotoSaving(false);
    setTimeout(() => setPhotoSuccess(false), 2500);
  };

  const handleSetPosition = async (pos: 'top' | 'center' | 'bottom') => {
    setPhotoError('');
    setPhotoSuccess(false);
    setPhotoSaving(true);

    const { error: dbError } = await supabase
      .from('property_applications')
      .update({ cover_photo_position: pos })
      .eq('id', property.id);

    if (dbError) {
      setPhotoError(t('host.editModal.errorSaveFramingFailed'));
      setPhotoSaving(false);
      return;
    }

    setCoverPhotoPosition(pos);
    setPhotoSuccess(true);
    setPhotoSaving(false);
    setTimeout(() => setPhotoSuccess(false), 2000);
  };

  const descLen = description.length;
  const descMax = 1500;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('host.editModal.title')}</h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs notranslate" translate="no">{property.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-1 mr-6 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <i className="ri-settings-3-line text-xs"></i>
              {t('host.editModal.tabSettings')}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'photos'
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <i className="ri-image-line text-xs"></i>
              {t('host.editModal.tabPhotos')}
              {photos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{photos.length}</span>
              )}
            </span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── SETTINGS TAB ── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">

              {/* ── COTTAGE NAME ── */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-home-4-line text-emerald-600 text-sm"></i>
                  </div>
                  <label className="text-sm font-semibold text-gray-900">
                    {t('host.editModal.cottageName')}
                    <span className="text-red-400 ml-0.5">*</span>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  {t('host.editModal.cottageNameHint')}
                </p>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 90))}
                  maxLength={90}
                  className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 notranslate"
                  translate="no"
                  placeholder={t('host.editModal.cottageNamePlaceholder')}
                />
                <p className={`text-xs mt-1 text-right ${title.length > 80 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {title.length}/90
                </p>
              </div>

              {/* ── PRICING MODEL ── */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-price-tag-3-line text-emerald-600 text-sm"></i>
                  </div>
                  <label className="text-sm font-semibold text-gray-900">{t('host.editModal.pricingModel')}</label>
                </div>
                <p className="text-xs text-gray-400 mb-3">{t('host.editModal.pricingModelHint')}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Fixed price */}
                  <button
                    type="button"
                    onClick={() => setPricingType('fixed')}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      pricingType === 'fixed'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-line hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        pricingType === 'fixed' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {pricingType === 'fixed' && <i className="ri-check-line text-white text-[10px]"></i>}
                      </div>
                      <span className={`text-sm font-semibold ${pricingType === 'fixed' ? 'text-emerald-800' : 'text-gray-700'}`}>
                        {t('host.editModal.fixedPrice')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {t('host.editModal.fixedPriceDesc')}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      pricingType === 'fixed' ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t('host.editModal.fixedPriceBadge')}
                    </span>
                  </button>

                  {/* Per-guest price */}
                  <button
                    type="button"
                    onClick={() => setPricingType('per_guest')}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      pricingType === 'per_guest'
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-line hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        pricingType === 'per_guest' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                      }`}>
                        {pricingType === 'per_guest' && <i className="ri-check-line text-white text-[10px]"></i>}
                      </div>
                      <span className={`text-sm font-semibold ${pricingType === 'per_guest' ? 'text-amber-800' : 'text-gray-700'}`}>
                        {t('host.editModal.perGuestPrice')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {t('host.editModal.perGuestPriceDesc')}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      pricingType === 'per_guest' ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t('host.editModal.perGuestPriceBadge')}
                    </span>
                  </button>
                </div>

                {/* Fixed price input */}
                {pricingType === 'fixed' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('host.editModal.nightlyRateLabel')} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">₾</span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder={t('host.editModal.nightlyRatePlaceholder')}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{t('host.editModal.fixedPriceNote')}</p>
                  </div>
                )}

                {/* Per-guest tier inputs */}
                {pricingType === 'per_guest' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-information-line text-amber-500 text-sm"></i>
                      </div>
                      <p className="text-xs text-amber-700 font-medium">
                        {t('host.editModal.tierInfo')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {guestTiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-1.5 min-w-[90px]">
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-user-line text-gray-400 text-xs"></i>
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {tier.min_guests === tier.max_guests
                                ? t('common.guests', { count: tier.min_guests })
                                : t('host.editModal.guestRange', { min: tier.min_guests, max: tier.max_guests })}
                            </span>
                          </div>
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">₾</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.price_per_night || ''}
                              onChange={(e) => updateTierPrice(idx, e.target.value)}
                              placeholder={t('host.editModal.tierPricePlaceholder')}
                              className="w-full pl-7 pr-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            />
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{t('host.editModal.perNightSuffix')}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {t('host.editModal.tiersBasedOnMax', { count: maxGuests })}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  {t('host.editModal.description')}
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  {t('host.editModal.descriptionHint')}
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, descMax))}
                  rows={7}
                  className="w-full text-sm border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  placeholder={t('host.editModal.descriptionPlaceholder')}
                />
                <p className={`text-xs mt-1 text-right ${descLen > descMax - 100 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {descLen}/{descMax}
                </p>
              </div>

              {/* Location / Google Maps */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-map-pin-line text-emerald-600 text-sm"></i>
                  </div>
                  <label className="text-sm font-semibold text-gray-900">{t('host.editModal.exactLocation')}</label>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {t('host.editModal.exactLocationHint')}
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('host.editModal.addressLabel')}</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={t('host.editModal.addressPlaceholder')}
                      className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('host.editModal.googleMapsLabel')}</label>
                    <input
                      type="url"
                      value={googleMapsUrl}
                      onChange={(e) => setGoogleMapsUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {t('host.editModal.googleMapsHint')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('host.editModal.latitudeLabel')}</label>
                      <input
                        type="text"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder={t('host.editModal.latitudePlaceholder')}
                        className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('host.editModal.longitudeLabel')}</label>
                      <input
                        type="text"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder={t('host.editModal.longitudePlaceholder')}
                        className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {t('host.editModal.coordsHint')}
                  </p>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('host.editModal.amenitiesLabel')}</label>
                <p className="text-xs text-gray-400 mb-3">{t('host.editModal.amenitiesHint')}</p>

                {amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {amenities.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-full font-medium"
                      >
                        {translateVocab(t, 'amenities', a)}
                        <button
                          onClick={() => removeAmenity(a)}
                          className="w-3.5 h-3.5 flex items-center justify-center text-emerald-500 hover:text-red-500 cursor-pointer transition-colors rounded-full"
                        >
                          <i className="ri-close-line text-[10px]"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {AMENITY_SUGGESTIONS.filter((a) => !amenities.includes(a)).map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      className="px-2.5 py-1 text-xs border border-line text-gray-600 rounded-full hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      + {translateVocab(t, 'amenities', a)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity(); } }}
                    placeholder={t('host.editModal.customAmenityPlaceholder')}
                    className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    onClick={addCustomAmenity}
                    disabled={!customAmenity.trim()}
                    className="px-3 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>

              {/* Booking Approval Mode */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-settings-3-line text-emerald-600 text-sm"></i>
                  </div>
                  <label className="text-sm font-semibold text-gray-900">{t('host.editModal.approvalMode')}</label>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {t('host.editModal.approvalModeHint')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApprovalMode('auto_confirm')}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      approvalMode === 'auto_confirm'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-line hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        approvalMode === 'auto_confirm' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {approvalMode === 'auto_confirm' && (
                          <i className="ri-check-line text-white text-[10px]"></i>
                        )}
                      </div>
                      <span className={`text-sm font-semibold ${approvalMode === 'auto_confirm' ? 'text-emerald-800' : 'text-gray-700'}`}>
                        {t('host.editModal.autoConfirm')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {t('host.editModal.autoConfirmDescPrefix')} <strong>{t('host.editModal.autoConfirmDescEmphasis')}</strong> {t('host.editModal.autoConfirmDescSuffix')}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      approvalMode === 'auto_confirm' ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t('host.editModal.autoConfirmBadge')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApprovalMode('manual_24h')}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      approvalMode === 'manual_24h'
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-line hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        approvalMode === 'manual_24h' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                      }`}>
                        {approvalMode === 'manual_24h' && (
                          <i className="ri-check-line text-white text-[10px]"></i>
                        )}
                      </div>
                      <span className={`text-sm font-semibold ${approvalMode === 'manual_24h' ? 'text-amber-800' : 'text-gray-700'}`}>
                        {t('host.editModal.manualApproval')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {t('host.editModal.manualDescPrefix')} <strong>{t('host.editModal.manualDescEmphasis')}</strong> {t('host.editModal.manualDescSuffix')}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      approvalMode === 'manual_24h' ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t('host.editModal.manualApprovalBadge')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Accepted Payment Methods */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-bank-card-2-line text-blue-600 text-sm"></i>
                  </div>
                  <label className="text-sm font-semibold text-gray-900">{t('host.editModal.paymentMethods')}</label>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {t('host.editModal.paymentMethodsHint')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([
                    { value: 'both', label: t('host.editModal.payBoth'), desc: t('host.editModal.payBothDesc') },
                    { value: 'online_only', label: t('host.editModal.payOnline'), desc: t('host.editModal.payOnlineDesc') },
                    { value: 'pay_at_property_only', label: t('host.editModal.payAtProperty'), desc: t('host.editModal.payAtPropertyDesc') },
                  ] as const).map((opt) => {
                    const selected = acceptedPaymentMethods === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAcceptedPaymentMethods(opt.value)}
                        className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          selected ? 'border-blue-500 bg-blue-50' : 'border-line hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                            {selected && <i className="ri-check-line text-white text-[10px]"></i>}
                          </div>
                          <span className={`text-sm font-semibold ${selected ? 'text-blue-800' : 'text-gray-700'}`}>{opt.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line"></i>
                  </div>
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-checkbox-circle-line"></i>
                  </div>
                  {t('host.editModal.savedSuccess')}
                </div>
              )}
            </div>
          )}

          {/* ── PHOTOS TAB ── */}
          {activeTab === 'photos' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-information-line text-emerald-600 text-sm"></i>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  {t('host.editModal.coverInfoPrefix')} <strong>{t('host.editModal.coverInfoCoverPhoto')}</strong> {t('host.editModal.coverInfoMiddle')} <strong>{t('host.editModal.coverInfoMakeCover')}</strong> {t('host.editModal.coverInfoSuffix')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('host.editModal.uploadNewPhoto')}</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 flex items-center justify-center animate-spin">
                        <i className="ri-loader-4-line"></i>
                      </div>
                      {t('common.uploading')}
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-upload-cloud-line"></i>
                      </div>
                      {t('host.editModal.uploadPhotoMax')}
                    </>
                  )}
                </button>
              </div>

              {photos.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <div className="w-12 h-12 flex items-center justify-center mb-3">
                    <i className="ri-image-line text-4xl"></i>
                  </div>
                  <p className="text-sm font-medium text-gray-500">{t('host.editModal.noPhotos')}</p>
                  <p className="text-xs mt-1">{t('host.editModal.noPhotosHint')}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    {t('host.editModal.allPhotos', { count: photos.length })}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((url, idx) => {
                      const isCover = url === coverPhotoUrl;
                      return (
                        <div
                          key={idx}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                            isCover ? 'border-emerald-500' : 'border-line hover:border-gray-300'
                          }`}
                        >
                          <div className="w-full h-32">
                            <img
                              src={url}
                              alt={t('host.editModal.photoAlt', { num: idx + 1 })}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>

                          {/* Cover badge */}
                          {isCover && (
                            <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              <div className="w-3 h-3 flex items-center justify-center">
                                <i className="ri-star-fill text-[10px]"></i>
                              </div>
                              {t('host.editModal.coverBadge')}
                            </div>
                          )}

                          {/* Set as cover button */}
                          {!isCover && (
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-end justify-center pb-2 opacity-0 hover:opacity-100">
                              <button
                                onClick={() => handleSetCover(url)}
                                disabled={photoSaving}
                                className="flex items-center gap-1 bg-white text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer whitespace-nowrap hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50"
                              >
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <i className="ri-star-line text-[10px]"></i>
                                </div>
                                {t('host.editModal.makeCover')}
                              </button>
                            </div>
                          )}

                          {/* Photo number */}
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md">
                            {idx + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current cover preview */}
              {coverPhotoUrl && (
                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-star-fill text-emerald-500 text-sm"></i>
                    </div>
                    {t('host.editModal.currentCover')}
                  </p>
                  <div className="w-full h-40 rounded-lg overflow-hidden">
                    <img
                      src={coverPhotoUrl}
                      alt={t('host.editModal.currentCoverAlt')}
                      className={`w-full h-full object-cover ${
                        coverPhotoPosition === 'top' ? 'object-top' :
                        coverPhotoPosition === 'bottom' ? 'object-bottom' :
                        'object-center'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{t('host.editModal.currentCoverHint')}</p>

                  {/* Position / framing picker */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-crop-line text-emerald-500 text-sm"></i>
                      </div>
                      {t('host.editModal.cardFraming')}
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      {t('host.editModal.cardFramingHint')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['top', 'center', 'bottom'] as const).map((pos) => {
                        const labels: Record<string, string> = { top: t('host.editModal.framingTop'), center: t('host.editModal.framingCenter'), bottom: t('host.editModal.framingBottom') };
                        const icons: Record<string, string> = { top: 'ri-arrow-up-line', center: 'ri-align-vertically', bottom: 'ri-arrow-down-line' };
                        const isActive = coverPhotoPosition === pos;
                        return (
                          <button
                            key={pos}
                            onClick={() => handleSetPosition(pos)}
                            disabled={photoSaving}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                              isActive
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-line text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="w-5 h-5 flex items-center justify-center">
                              <i className={`${icons[pos]} text-base`}></i>
                            </div>
                            {labels[pos]}
                            {isActive && (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">{t('common.active')}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      <i className="ri-information-line mr-1"></i>
                      {t('host.editModal.framingPreviewNote')}
                    </p>
                  </div>
                </div>
              )}

              {photoError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line"></i>
                  </div>
                  {photoError}
                </div>
              )}

              {photoSuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl px-4 py-3">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-checkbox-circle-line"></i>
                  </div>
                  {t('host.editModal.coverUpdated')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
          {activeTab === 'settings' ? (
            <>
              <p className="text-xs text-gray-400">
                <i className="ri-information-line mr-1"></i>
                {t('host.editModal.settingsFooterNote')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || success}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {saving ? (
                    <>
                      <div className="w-3 h-3 flex items-center justify-center animate-spin">
                        <i className="ri-loader-4-line"></i>
                      </div>
                      {t('common.saving')}
                    </>
                  ) : success ? (
                    <>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-check-line"></i>
                      </div>
                      {t('host.editModal.savedShort')}
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-save-line"></i>
                      </div>
                      {t('host.editModal.saveChanges')}
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                <i className="ri-image-line mr-1"></i>
                {t('host.editModal.photosFooterNote')}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('common.done')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
