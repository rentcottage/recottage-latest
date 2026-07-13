import { useState, useRef } from 'react';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import AutocompleteInput from '../../components/base/AutocompleteInput';
import SEO from '../../components/feature/SEO';
import { georgianCities } from '../../mocks/georgian-cities';
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../lib/imageCompression';
import { useTranslation, translateVocab } from '@lib/i18n';

const PROPERTY_APP_FN_URL =
  'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/property-application-handler';

const HCAPTCHA_SITE_KEY = '7c3ed03a-c4f2-4bd4-8bda-e8a291bc5ede';

export default function BecomeHost() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [pricingType, setPricingType] = useState<'fixed' | 'per_guest'>('fixed');
  const [guestTierPrices, setGuestTierPrices] = useState<Record<number, string>>({});
  const [hostCaptchaToken, setHostCaptchaToken] = useState('');
  const hostCaptchaRef = useRef<HCaptchaLib>(null);

  const [formData, setFormData] = useState({
    propertyType: '',
    location: '',
    bedrooms: '',
    bathrooms: '',
    guests: '',
    amenities: [] as string[],
    categories: [] as string[],
    photos: [] as File[],
    title: '',
    description: '',
    price: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    acceptedPaymentMethods: 'both',
  });

  const maxGuestsNum = parseInt(formData.guests) || 0;
  const guestRange = maxGuestsNum > 0 ? Array.from({ length: maxGuestsNum }, (_, i) => i + 1) : [];

  const updateTierPrice = (guestCount: number, value: string) => {
    setGuestTierPrices(prev => ({ ...prev, [guestCount]: value }));
  };

  const buildGuestTiers = () =>
    guestRange.map(n => ({
      min_guests: n,
      max_guests: n,
      price_per_night: parseFloat(guestTierPrices[n] || '0') || 0,
    }));

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 15 * 1024 * 1024; // 15MB limit
      return isValidType && isValidSize;
    });

    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...validFiles].slice(0, 10) // Max 10 photos
    }));
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const nextStep = () => {
    const fail = (msg: string) => {
      setErrorDetail(msg);
      setSubmitStatus('error');
    };

    if (currentStep === 1) {
      const missing: string[] = [];
      if (!formData.propertyType) missing.push(t('becomeHost.fields.propertyType'));
      if (!formData.location) missing.push(t('becomeHost.fields.location'));
      if (!formData.bedrooms) missing.push(t('becomeHost.fields.bedrooms'));
      if (!formData.bathrooms) missing.push(t('becomeHost.fields.bathrooms'));
      if (!formData.guests) missing.push(t('becomeHost.fields.maxGuests'));
      if (missing.length) { fail(t('becomeHost.validation.stepMissing', { step: 1, fields: missing.join(', ') })); return; }
    }

    if (currentStep === 3) {
      if (formData.photos.length < 3) {
        fail(t('becomeHost.validation.needPhotos', { count: formData.photos.length }));
        return;
      }
    }

    if (currentStep === 4) {
      const missing: string[] = [];
      if (!formData.title) missing.push(t('becomeHost.fields.propertyTitle'));
      if (!formData.description) missing.push(t('becomeHost.fields.description'));
      if (formData.description.length > 2000) missing.push(t('becomeHost.validation.descriptionTooLong'));
      if (pricingType === 'fixed') {
        if (!formData.price) missing.push(t('becomeHost.fields.price'));
      } else {
        const hasEmpty = guestRange.some(n => !guestTierPrices[n] || parseFloat(guestTierPrices[n]) <= 0);
        if (hasEmpty || guestRange.length === 0) missing.push(t('becomeHost.fields.perGuestPrice'));
      }
      if (missing.length) { fail(t('becomeHost.validation.stepMissing', { step: 4, fields: missing.join(', ') })); return; }
    }

    setErrorDetail('');
    setSubmitStatus('idle');
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!hostCaptchaToken) {
      setErrorDetail(t('becomeHost.validation.completeCaptcha'));
      setSubmitStatus('error');
      return;
    }

    const priceValid = pricingType === 'fixed'
      ? !!formData.price
      : guestRange.every(n => guestTierPrices[n] && parseFloat(guestTierPrices[n]) > 0);

    const withStep = (field: string, step: number) =>
      t('becomeHost.validation.fieldWithStep', { field, step });
    const missing: string[] = [];
    if (!formData.firstName) missing.push(t('becomeHost.fields.firstName'));
    if (!formData.lastName) missing.push(t('becomeHost.fields.lastName'));
    if (!formData.email) missing.push(t('becomeHost.fields.email'));
    if (!formData.phone) missing.push(t('becomeHost.fields.phone'));
    if (!formData.propertyType) missing.push(withStep(t('becomeHost.fields.propertyType'), 1));
    if (!formData.location) missing.push(withStep(t('becomeHost.fields.location'), 1));
    if (!formData.bedrooms) missing.push(withStep(t('becomeHost.fields.bedrooms'), 1));
    if (!formData.bathrooms) missing.push(withStep(t('becomeHost.fields.bathrooms'), 1));
    if (!formData.guests) missing.push(withStep(t('becomeHost.fields.maxGuests'), 1));
    if (!formData.title) missing.push(withStep(t('becomeHost.fields.propertyTitle'), 4));
    if (!formData.description) missing.push(withStep(t('becomeHost.fields.description'), 4));
    if (!priceValid) missing.push(withStep(t('becomeHost.fields.price'), 4));
    if (formData.photos.length < 3) missing.push(t('becomeHost.validation.photosHaveNeed', { count: formData.photos.length }));

    if (missing.length > 0) {
      setErrorDetail(t('becomeHost.validation.missingFields', { fields: missing.join(', ') }));
      setSubmitStatus('error');
      return;
    }

    if (formData.description.length > 2000) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // 1. Compress + upload photos to Supabase Storage. Re-encoding shrinks
      //    full-resolution camera files before they ever leave the browser.
      const photoUrls: string[] = [];
      for (const photo of formData.photos) {
        const uploadFile = await compressImage(photo);
        const safeName = uploadFile.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
        const path = `${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          continue;
        }
        const { data: urlData } = supabase.storage
          .from('property-photos')
          .getPublicUrl(path);
        if (urlData?.publicUrl) {
          photoUrls.push(urlData.publicUrl);
        }
      }

      // 2. Submit application to edge function
      const response = await fetch(PROPERTY_APP_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_first_name: formData.firstName,
          host_last_name: formData.lastName,
          host_email: formData.email,
          host_phone: formData.phone,
          property_type: formData.propertyType,
          location: formData.location,
          bedrooms: parseInt(formData.bedrooms),
          bathrooms: parseInt(formData.bathrooms),
          max_guests: parseInt(formData.guests),
          amenities: formData.amenities,
          categories: formData.categories,
          photo_urls: photoUrls,
          title: formData.title,
          description: formData.description,
          price_per_night: pricingType === 'fixed'
            ? parseFloat(formData.price)
            : (buildGuestTiers()[0]?.price_per_night ?? 0),
          pricing_type: pricingType,
          guest_pricing_tiers: pricingType === 'per_guest' ? buildGuestTiers() : null,
          accepted_payment_methods: formData.acceptedPaymentMethods,
          captcha_token: hostCaptchaToken,
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        hostCaptchaRef.current?.resetCaptcha();
        setHostCaptchaToken('');
        // Reset all form fields after successful submission
        setFormData({
          propertyType: '',
          location: '',
          bedrooms: '',
          bathrooms: '',
          guests: '',
          amenities: [],
          categories: [],
          photos: [],
          title: '',
          description: '',
          price: '',
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          acceptedPaymentMethods: 'both',
        });
        setPricingType('fixed');
        setGuestTierPrices({});
        setCurrentStep(1);
      } else {
        let serverMsg = '';
        try {
          const txt = await response.text();
          try { serverMsg = (JSON.parse(txt).error as string) || txt; } catch { serverMsg = txt; }
        } catch { /* ignore */ }
        setErrorDetail(t('becomeHost.validation.serverRejected', { status: response.status }) + (serverMsg ? ': ' + serverMsg : ''));
        setSubmitStatus('error');
        hostCaptchaRef.current?.resetCaptcha();
        setHostCaptchaToken('');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setErrorDetail(t('becomeHost.validation.networkError', { message: error instanceof Error ? error.message : String(error) }));
      setSubmitStatus('error');
      hostCaptchaRef.current?.resetCaptcha();
      setHostCaptchaToken('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Become a Host — List Your Georgian Cottage on RentCottage.Ge',
    description: 'List your Georgian cottage or traditional home. Earn income while sharing authentic Georgian culture with travelers. Easy listing process, host protection and dedicated support.',
    url: `${siteUrl}/become-host`,
    isPartOf: { '@type': 'WebSite', name: 'RentCottage.Ge', url: siteUrl },
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={t('becomeHost.seo.title')}
        description="List your Georgian cottage or traditional home and earn extra income. Share authentic Georgian culture with travelers from around the world. Easy listing, host protection and dedicated support."
        keywords="become host Georgia, list cottage Georgia, rent out Georgian cottage, host Georgian property, earn money hosting Georgia"
        canonical="/become-host"
        jsonLd={jsonLd}
      />
      <Header />
      
      {/* Hero Section */}
      <section 
        className="relative h-[260px] md:h-[400px] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url('https://readdy.ai/api/search-image?query=traditional%20Georgian%20stone%20cottage%20nestled%20in%20Svaneti%20mountain%20valley%2C%20tall%20Caucasus%20peaks%20covered%20in%20snow%20in%20background%2C%20dense%20pine%20and%20fir%20forest%2C%20rustic%20timber%20roof%2C%20alpine%20meadow%20with%20wildflowers%2C%20soft%20golden%20hour%20light%2C%20dramatic%20sky%2C%20cinematic%20landscape%20photography%2C%20no%20people%2C%20highly%20detailed%2C%20premium%20travel%20image&width=1400&height=500&seq=becomeHostMountainCottage01&orientation=landscape')`
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-2xl md:text-[40px] font-extrabold text-white tracking-tight mb-3 md:mb-4">
            {t('becomeHost.hero.title')}
          </h1>
          <p className="text-sm md:text-xl text-white/90 mb-5 md:mb-7 max-w-2xl">
            {t('becomeHost.hero.subtitle')}
          </p>
          <div className="hidden md:flex flex-wrap justify-center gap-3 text-[13.5px] font-semibold">
            {[t('becomeHost.hero.badgeFreeListing'), t('becomeHost.hero.badgeSetPrice'), t('becomeHost.hero.badgeSupport')].map((b) => (
              <span key={b} className="bg-white/15 border border-white/30 text-white px-3.5 py-1.5 rounded-full">{b}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Success State — replaces progress + form */}
        {submitStatus === 'success' ? (
          <div className="w-full flex flex-col items-center py-8 md:py-16 px-4">
            <div className="w-full max-w-lg bg-green-50 border border-green-200 rounded-2xl p-6 md:p-10 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <div className="w-8 h-8 flex items-center justify-center">
                  <i className="ri-check-line text-3xl text-green-600"></i>
                </div>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-green-800 mb-3">{t('becomeHost.success.title')}</h2>
              <p className="text-green-700 text-sm md:text-base leading-relaxed mb-6">
                {t('becomeHost.success.message')}
              </p>
              <button
                type="button"
                onClick={() => setSubmitStatus('idle')}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 cursor-pointer whitespace-nowrap text-sm md:text-base"
              >
                {t('becomeHost.success.submitAnother')}
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* Error Message */}
        {submitStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6 mb-6 md:mb-8">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-500 text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm md:text-base font-semibold text-red-800 mb-1">{t('becomeHost.validation.heading')}</h3>
                <p className="text-red-700 text-sm">
                  {errorDetail
                    ? errorDetail
                    : currentStep === 3 && formData.photos.length < 3
                    ? t('becomeHost.validation.uploadPhotosPrompt')
                    : t('becomeHost.validation.allRequired')
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6 md:mb-12 w-full">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center min-w-0">
              <div className={`w-7 h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-xs md:text-base flex-shrink-0 ${
                step <= currentStep ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              {step < 5 && (
                <div className={`flex-1 h-0.5 md:h-1 mx-1.5 md:mx-4 min-w-[16px] md:min-w-[64px] ${
                  step < currentStep ? 'bg-red-500' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <form className="bg-white rounded-xl shadow-lg p-4 md:p-8">
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">{t('becomeHost.step1.title')}</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.propertyType')} *</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['Cottage', 'Cabin', 'Farmhouse', 'Villa'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleInputChange('propertyType', type);
                        }}
                        className={`p-4 border rounded-lg text-center cursor-pointer whitespace-nowrap ${
                          formData.propertyType === type 
                            ? 'border-red-500 bg-red-50 text-red-700' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {translateVocab(t, 'propertyType', type)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">
                    {t('becomeHost.fields.propertyCategories')} <span className="text-gray-400 font-normal">{t('becomeHost.step1.selectAllThatApply')}</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Mountain', icon: 'ri-landscape-line' },
                      { label: 'Lakeside', icon: 'ri-ship-line' },
                      { label: 'Traditional', icon: 'ri-building-2-line' },
                      { label: 'Forest', icon: 'ri-tree-line' },
                      { label: 'Countryside', icon: 'ri-sun-line' },
                      { label: 'Winery', icon: 'ri-goblet-line' },
                    ].map(({ label, icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCategoryToggle(label);
                        }}
                        className={`flex items-center gap-3 p-3 border rounded-lg text-left cursor-pointer transition-colors ${
                          formData.categories.includes(label)
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <i className={`${icon} text-base`}></i>
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">{translateVocab(t, 'categories', label)}</span>
                        {formData.categories.includes(label) && (
                          <div className="ml-auto w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-check-line text-red-500 text-sm"></i>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {formData.categories.length > 0 && (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      {t('becomeHost.step1.selected', { list: formData.categories.map((c) => translateVocab(t, 'categories', c)).join(', ') })}
                    </p>
                  )}
                </div>

                <AutocompleteInput
                  label={t('becomeHost.fields.location')}
                  placeholder={t('becomeHost.step1.locationPlaceholder')}
                  value={formData.location}
                  onChange={(value) => handleInputChange('location', value)}
                  options={georgianCities}
                  required={true}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.bedrooms')} *</label>
                    <select
                      value={formData.bedrooms}
                      onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8"
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {[1,2,3,4,5,6].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.bathrooms')} *</label>
                    <select
                      value={formData.bathrooms}
                      onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8"
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {[1,2,3,4,5].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.maxGuests')} *</label>
                    <select
                      value={formData.guests}
                      onChange={(e) => handleInputChange('guests', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8"
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">{t('becomeHost.step2.title')}</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {[
                  { label: 'WiFi', icon: 'ri-wifi-line' },
                  { label: 'Kitchen', icon: 'ri-restaurant-line' },
                  { label: 'Fireplace', icon: 'ri-fire-line' },
                  { label: 'Swimming Pool', icon: 'ri-water-flash-line' },
                  { label: 'Parking', icon: 'ri-parking-line' },
                  { label: 'Hot Tub', icon: 'ri-drop-line' },
                  { label: 'Mountain View', icon: 'ri-landscape-line' },
                  { label: 'Lake Access', icon: 'ri-water-flash-line' },
                  { label: 'BBQ Grill', icon: 'ri-fire-fill' },
                  { label: 'Pet Friendly', icon: 'ri-bear-smile-line' },
                  { label: 'Heating', icon: 'ri-temp-hot-line' },
                  { label: 'Air Conditioning', icon: 'ri-temp-cold-line' },
                ].map(({ label, icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAmenityToggle(label);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-2 border rounded-lg cursor-pointer transition-colors min-w-0 ${
                      formData.amenities.includes(label)
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      <i className={`${icon} text-sm`}></i>
                    </div>
                    <span className="text-xs font-medium truncate leading-tight">{translateVocab(t, 'amenities', label)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">{t('becomeHost.step3.title')} *</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="w-6 h-6 flex items-center justify-center mr-3 mt-0.5">
                      <i className="ri-information-line text-blue-500"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">{t('becomeHost.step3.guidelinesTitle')}</h3>
                      <ul className="text-blue-800 text-sm space-y-1">
                        <li>• {t('becomeHost.step3.guideline1')}</li>
                        <li>• {t('becomeHost.step3.guideline2')}</li>
                        <li>• {t('becomeHost.step3.guideline3')}</li>
                        <li>• {t('becomeHost.step3.guideline4')}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">
                    {t('becomeHost.step3.photosLabel')}
                  </label>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-400 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <i className="ri-camera-line text-2xl text-gray-400"></i>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t('becomeHost.step3.uploadTitle')}</h3>
                      <p className="text-gray-600 mb-4">
                        {t('becomeHost.step3.dragDrop')}
                      </p>
                      <span className="inline-block px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer whitespace-nowrap">
                        {t('becomeHost.step3.chooseFiles')}
                      </span>
                    </label>
                  </div>

                  <p className="text-sm text-gray-500 mt-2">
                    {t('becomeHost.step3.supportedFormats')}
                  </p>
                </div>

                {/* Photo Preview Grid */}
                {formData.photos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {t('becomeHost.step3.uploadedPhotos', { count: formData.photos.length })}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {formData.photos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={t('becomeHost.step3.photoAlt', { number: index + 1 })}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <i className="ri-close-line text-sm"></i>
                          </button>
                          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {index === 0 ? t('becomeHost.step3.mainPhoto') : `${index + 1}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{t('becomeHost.step3.tipsTitle')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">{t('becomeHost.step3.mustHaveTitle')}</h4>
                      <ul className="space-y-1">
                        <li>• {t('becomeHost.step3.mustHave1')}</li>
                        <li>• {t('becomeHost.step3.mustHave2')}</li>
                        <li>• {t('becomeHost.step3.mustHave3')}</li>
                        <li>• {t('becomeHost.step3.mustHave4')}</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">{t('becomeHost.step3.additionsTitle')}</h4>
                      <ul className="space-y-1">
                        <li>• {t('becomeHost.step3.addition1')}</li>
                        <li>• {t('becomeHost.step3.addition2')}</li>
                        <li>• {t('becomeHost.step3.addition3')}</li>
                        <li>• {t('becomeHost.step3.addition4')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">{t('becomeHost.step4.title')}</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">
                    {t('becomeHost.fields.propertyTitle')} *
                  </label>
                  <input
                    type="text"
                    placeholder={t('becomeHost.step4.titlePlaceholder')}
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.description')} *</label>
                  <textarea
                    rows={8}
                    placeholder={t('becomeHost.step4.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    maxLength={2000}
                    required
                  ></textarea>
                  <div className={`text-sm mt-2 ${formData.description.length > 1800 ? 'text-orange-500' : 'text-gray-500'}`}>
                    {t('becomeHost.step4.charCount', { count: formData.description.length })}
                  </div>
                </div>

                {/* Pricing Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">{t('becomeHost.step4.pricingModel')} *</label>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setPricingType('fixed')}
                      className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                        pricingType === 'fixed'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          pricingType === 'fixed' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                        }`}>
                          {pricingType === 'fixed' && <i className="ri-check-line text-white text-[10px]"></i>}
                        </div>
                        <span className={`text-sm font-semibold ${pricingType === 'fixed' ? 'text-red-700' : 'text-gray-700'}`}>
                          {t('becomeHost.step4.fixedPrice')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {t('becomeHost.step4.fixedPriceDesc')}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        pricingType === 'fixed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>{t('becomeHost.step4.fixedPriceBadge')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPricingType('per_guest')}
                      disabled={maxGuestsNum === 0}
                      className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                        pricingType === 'per_guest'
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          pricingType === 'per_guest' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                        }`}>
                          {pricingType === 'per_guest' && <i className="ri-check-line text-white text-[10px]"></i>}
                        </div>
                        <span className={`text-sm font-semibold ${pricingType === 'per_guest' ? 'text-amber-800' : 'text-gray-700'}`}>
                          {t('becomeHost.step4.byGuestCount')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {t('becomeHost.step4.byGuestCountDesc')}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        pricingType === 'per_guest' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>{t('becomeHost.step4.byGuestCountBadge')}</span>
                    </button>
                  </div>

                  {/* Fixed price input */}
                  {pricingType === 'fixed' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {t('becomeHost.step4.nightlyRate')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₾</span>
                        <input
                          type="number"
                          placeholder={t('becomeHost.step4.pricePlaceholder')}
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          className="w-full p-3 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          min="1"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{t('becomeHost.step4.fixedPriceNote')}</p>
                    </div>
                  )}

                  {/* Per-guest tier inputs */}
                  {pricingType === 'per_guest' && (
                    <div>
                      {maxGuestsNum === 0 ? (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                          <i className="ri-information-line text-amber-500 text-sm"></i>
                          <p className="text-xs text-amber-700">{t('becomeHost.step4.selectMaxGuestsFirst')}</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                            <i className="ri-information-line text-amber-500 text-sm"></i>
                            <p className="text-xs text-amber-700 font-medium">
                              {t('becomeHost.step4.perGuestInfo')}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {guestRange.map((n) => (
                              <div key={n} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                                <div className="flex items-center gap-1.5 min-w-[80px]">
                                  <i className="ri-user-line text-gray-400 text-xs"></i>
                                  <span className="text-sm font-medium text-gray-700">
                                    {t('common.guests', { count: n })}
                                  </span>
                                </div>
                                <div className="flex-1 relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">₾</span>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={guestTierPrices[n] || ''}
                                    onChange={(e) => updateTierPrice(n, e.target.value)}
                                    placeholder={t('becomeHost.step4.pricePerNight')}
                                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                  />
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap">{t('becomeHost.step4.perNight')}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">{t('becomeHost.step4.acceptedPayments')} *</label>
                  <p className="text-xs text-gray-500 mb-3">{t('becomeHost.step4.acceptedPaymentsDesc')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { value: 'both', label: t('becomeHost.step4.paymentBoth'), desc: t('becomeHost.step4.paymentBothDesc'), icon: 'ri-bank-card-2-line' },
                      { value: 'online_only', label: t('becomeHost.step4.paymentOnline'), desc: t('becomeHost.step4.paymentOnlineDesc'), icon: 'ri-bank-card-line' },
                      { value: 'pay_at_property_only', label: t('becomeHost.step4.paymentAtProperty'), desc: t('becomeHost.step4.paymentAtPropertyDesc'), icon: 'ri-home-heart-line' },
                    ] as const).map((opt) => {
                      const selected = formData.acceptedPaymentMethods === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleInputChange('acceptedPaymentMethods', opt.value)}
                          className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                            selected ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                              {selected && <i className="ri-check-line text-white text-[10px]"></i>}
                            </div>
                            <span className={`text-sm font-semibold ${selected ? 'text-red-700' : 'text-gray-700'}`}>{opt.label}</span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
                          <i className={`${opt.icon} ${selected ? 'text-red-500' : 'text-gray-400'}`}></i>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">{t('becomeHost.step5.title')}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.firstName')} *</label>
                    <input
                      type="text"
                      placeholder={t('becomeHost.step5.firstNamePlaceholder')}
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.lastName')} *</label>
                    <input
                      type="text"
                      placeholder={t('becomeHost.step5.lastNamePlaceholder')}
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.email')} *</label>
                  <input
                    type="email"
                    placeholder={t('becomeHost.step5.emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">{t('becomeHost.fields.phone')} *</label>
                  <input
                    type="tel"
                    placeholder={t('becomeHost.step5.phonePlaceholder')}
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">{t('becomeHost.step5.whatHappensNext')}</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-3">
                        <i className="ri-check-line text-green-500"></i>
                      </div>
                      {t('becomeHost.step5.next1')}
                    </li>
                    <li className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-3">
                        <i className="ri-check-line text-green-500"></i>
                      </div>
                      {t('becomeHost.step5.next2')}
                    </li>
                    <li className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-3">
                        <i className="ri-check-line text-green-500"></i>
                      </div>
                      {t('becomeHost.step5.next3')}
                    </li>
                  </ul>
                </div>

                {/* CAPTCHA before final submit */}
                <div className="flex justify-center mt-4">
                  <HCaptchaLib
                    ref={hostCaptchaRef}
                    sitekey={HCAPTCHA_SITE_KEY}
                    onVerify={(token) => setHostCaptchaToken(token)}
                    onExpire={() => setHostCaptchaToken('')}
                    onError={() => setHostCaptchaToken('')}
                    theme="light"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-6 py-3 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                currentStep === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t('common.previous')}
            </button>
            
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 cursor-pointer whitespace-nowrap"
              >
                {t('becomeHost.nav.nextStep')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !hostCaptchaToken}
                className={`px-8 py-3 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                  isSubmitting || !hostCaptchaToken
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isSubmitting ? t('common.submitting') : t('becomeHost.nav.submitApplication')}
              </button>
            )}
          </div>
        </form>
        </>
        )}

        {/* Benefits Section */}
        <section className="mt-6 md:mt-16 bg-gray-50 rounded-2xl p-4 md:p-8">
          <h2 className="text-base md:text-3xl font-bold text-gray-900 text-center mb-4 md:mb-8">{t('becomeHost.benefits.title')}</h2>
          
          <div className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-8">
            {[
              { icon: 'ri-money-dollar-circle-line', title: t('becomeHost.benefits.earnTitle'), desc: t('becomeHost.benefits.earnDesc') },
              { icon: 'ri-shield-check-line', title: t('becomeHost.benefits.protectionTitle'), desc: t('becomeHost.benefits.protectionDesc') },
              { icon: 'ri-customer-service-2-line', title: t('becomeHost.benefits.supportTitle'), desc: t('becomeHost.benefits.supportDesc') },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 md:flex-col md:items-center md:text-center">
                <div className="w-9 h-9 md:w-16 md:h-16 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 md:mx-auto md:mb-4">
                  <i className={`${icon} text-base md:text-2xl text-red-500`}></i>
                </div>
                <div className="md:block">
                  <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-0.5 md:mb-2">{title}</h3>
                  <p className="text-xs md:text-base text-gray-600 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />
    </div>
  );
}
