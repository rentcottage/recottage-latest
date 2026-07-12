import { useState, useRef, useEffect } from 'react';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import AutocompleteInput from '../../components/base/AutocompleteInput';
import SEO from '../../components/feature/SEO';
import { georgianCities } from '../../mocks/georgian-cities';
import { supabase } from '../../lib/supabase';

const PROPERTY_APP_FN_URL =
  'https://fkjkyzpunatzkovqxyzp.supabase.co/functions/v1/property-application-handler';

const HCAPTCHA_SITE_KEY = '7c3ed03a-c4f2-4bd4-8bda-e8a291bc5ede';

function useCurrentLang(): string {
  const [lang, setLang] = useState<string>(() => {
    try {
      const cookies = document.cookie.split('; ');
      const gt = cookies.find((c) => c.startsWith('googtrans='));
      if (gt) {
        const parts = gt.split('=')[1].split('/');
        const code = parts[parts.length - 1];
        if (code && code.length === 2) return code;
      }
    } catch { /* ignore */ }
    return 'en';
  });

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const cookies = document.cookie.split('; ');
        const gt = cookies.find((c) => c.startsWith('googtrans='));
        if (gt) {
          const parts = gt.split('=')[1].split('/');
          const code = parts[parts.length - 1];
          if (code && code.length === 2) {
            setLang(code);
            return;
          }
        }
      } catch { /* ignore */ }
      setLang('en');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return lang;
}

export default function BecomeHost() {
  const currentLang = useCurrentLang();
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
      if (!formData.propertyType) missing.push('Property Type');
      if (!formData.location) missing.push('Location');
      if (!formData.bedrooms) missing.push('Bedrooms');
      if (!formData.bathrooms) missing.push('Bathrooms');
      if (!formData.guests) missing.push('Guests');
      if (missing.length) { fail('Step 1 missing: ' + missing.join(', ')); return; }
    }

    if (currentStep === 3) {
      if (formData.photos.length < 3) {
        fail(`Step 3: need 3 photos, have ${formData.photos.length}`);
        return;
      }
    }

    if (currentStep === 4) {
      const missing: string[] = [];
      if (!formData.title) missing.push('Title');
      if (!formData.description) missing.push('Description');
      if (formData.description.length > 2000) missing.push('Description too long (max 2000)');
      if (pricingType === 'fixed') {
        if (!formData.price) missing.push('Price');
      } else {
        const hasEmpty = guestRange.some(n => !guestTierPrices[n] || parseFloat(guestTierPrices[n]) <= 0);
        if (hasEmpty || guestRange.length === 0) missing.push('Per-guest price');
      }
      if (missing.length) { fail('Step 4 missing: ' + missing.join(', ')); return; }
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
      setErrorDetail('Please complete the CAPTCHA before submitting.');
      setSubmitStatus('error');
      return;
    }

    const priceValid = pricingType === 'fixed'
      ? !!formData.price
      : guestRange.every(n => guestTierPrices[n] && parseFloat(guestTierPrices[n]) > 0);

    const missing: string[] = [];
    if (!formData.firstName) missing.push('First Name');
    if (!formData.lastName) missing.push('Last Name');
    if (!formData.email) missing.push('Email');
    if (!formData.phone) missing.push('Phone');
    if (!formData.propertyType) missing.push('Property Type (step 1)');
    if (!formData.location) missing.push('Location (step 1)');
    if (!formData.bedrooms) missing.push('Bedrooms (step 1)');
    if (!formData.bathrooms) missing.push('Bathrooms (step 1)');
    if (!formData.guests) missing.push('Guests (step 1)');
    if (!formData.title) missing.push('Title (step 4)');
    if (!formData.description) missing.push('Description (step 4)');
    if (!priceValid) missing.push('Price (step 4)');
    if (formData.photos.length < 3) missing.push(`Photos (step 3) — have ${formData.photos.length}, need 3`);

    if (missing.length > 0) {
      setErrorDetail('Missing: ' + missing.join(', '));
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
      // 1. Upload photos to Supabase Storage
      const photoUrls: string[] = [];
      for (const photo of formData.photos) {
        const safeName = photo.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
        const path = `${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(path, photo, { contentType: photo.type, upsert: false });
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
        setErrorDetail(`Server rejected the submission (HTTP ${response.status})${serverMsg ? ': ' + serverMsg : ''}`);
        setSubmitStatus('error');
        hostCaptchaRef.current?.resetCaptcha();
        setHostCaptchaToken('');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setErrorDetail(`Network error: ${error instanceof Error ? error.message : String(error)}`);
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
        title="Become a Host — List Your Georgian Cottage on RentCottage.Ge"
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
            Rent out your cottage and earn more
          </h1>
          <p className="text-sm md:text-xl text-white/90 mb-5 md:mb-7 max-w-2xl">
            List for free, get bookings directly, and pay a commission only on successful stays
          </p>
          <div className="hidden md:flex flex-wrap justify-center gap-3 text-[13.5px] font-semibold">
            {['✓ Free listing', '✓ You set the price', '✓ Support in Georgian'].map((b) => (
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
              <h2 className="text-xl md:text-2xl font-bold text-green-800 mb-3">Application Submitted!</h2>
              <p className="text-green-700 text-sm md:text-base leading-relaxed mb-6">
                Thank you for your interest in becoming a host. Our team will review your application and contact you within 24 hours.
              </p>
              <button
                type="button"
                onClick={() => setSubmitStatus('idle')}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 cursor-pointer whitespace-nowrap text-sm md:text-base"
              >
                Submit Another Application
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
                <h3 className="text-sm md:text-base font-semibold text-red-800 mb-1">Please Complete Required Fields</h3>
                <p className="text-red-700 text-sm">
                  {errorDetail
                    ? errorDetail
                    : currentStep === 3 && formData.photos.length < 3
                    ? 'Please upload at least 3 photos of your cottage to continue.'
                    : 'All fields marked with * are required. Please fill out all required information to continue.'
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
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">Tell us about your property</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">Property Type *</label>
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
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">
                    Property Categories <span className="text-gray-400 font-normal">(select all that apply)</span>
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
                        <span className="text-sm font-medium whitespace-nowrap">{label}</span>
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
                      Selected: {formData.categories.join(', ')}
                    </p>
                  )}
                </div>

                <AutocompleteInput
                  label="Location"
                  placeholder="Start typing a city name (e.g., Tbilisi, Batumi...)"
                  value={formData.location}
                  onChange={(value) => handleInputChange('location', value)}
                  options={georgianCities}
                  required={true}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">Bedrooms *</label>
                    <select
                      value={formData.bedrooms}
                      onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8"
                      required
                    >
                      <option value="">Select</option>
                      {[1,2,3,4,5,6].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">Bathrooms *</label>
                    <select
                      value={formData.bathrooms}
                      onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8"
                      required
                    >
                      <option value="">Select</option>
                      {[1,2,3,4,5].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">Max Guests *</label>
                    <select
                      value={formData.guests}
                      onChange={(e) => handleInputChange('guests', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8"
                      required
                    >
                      <option value="">Select</option>
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
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">What amenities do you offer?</h2>
              
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
                    <span className="text-xs font-medium truncate leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">Upload Photos of Your Cottage *</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="w-6 h-6 flex items-center justify-center mr-3 mt-0.5">
                      <i className="ri-information-line text-blue-500"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">Photo Guidelines</h3>
                      <ul className="text-blue-800 text-sm space-y-1">
                        <li>• Upload at least 3 photos (maximum 10)</li>
                        <li>• Include exterior, interior, and key amenity photos</li>
                        <li>• Use high-quality images (max 15MB each)</li>
                        <li>• Show your cottage in the best light</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">
                    Cottage Photos * (Minimum 3 required)
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
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Photos</h3>
                      <p className="text-gray-600 mb-4">
                        Drag and drop your photos here, or click to browse
                      </p>
                      <span className="inline-block px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer whitespace-nowrap">
                        Choose Files
                      </span>
                    </label>
                  </div>

                  <p className="text-sm text-gray-500 mt-2">
                    Supported formats: JPG, PNG, GIF. Maximum file size: 15MB per image.
                  </p>
                </div>

                {/* Photo Preview Grid */}
                {formData.photos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Uploaded Photos ({formData.photos.length}/10)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {formData.photos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Cottage photo ${index + 1}`}
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
                            {index === 0 ? 'Main' : `${index + 1}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Photo Tips for Better Bookings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Must-Have Shots:</h4>
                      <ul className="space-y-1">
                        <li>• Exterior front view</li>
                        <li>• Living room/main area</li>
                        <li>• All bedrooms</li>
                        <li>• Kitchen and dining area</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Great Additions:</h4>
                      <ul className="space-y-1">
                        <li>• Bathroom(s)</li>
                        <li>• Outdoor spaces/garden</li>
                        <li>• Special amenities</li>
                        <li>• Scenic views</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">Describe your property</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2 notranslate" translate="no">
                    {currentLang === 'ka' ? 'საკუთრების სახელი' : 'Property Title'} *
                  </label>
                  <input
                    type="text"
                    placeholder="Give your property a catchy title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">Description *</label>
                  <textarea
                    rows={8}
                    placeholder="Describe what makes your property special. Include details about the space, surroundings, nearby attractions, and what guests can expect..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    maxLength={2000}
                    required
                  ></textarea>
                  <div className={`text-sm mt-2 ${formData.description.length > 1800 ? 'text-orange-500' : 'text-gray-500'}`}>
                    {formData.description.length}/2000 characters
                  </div>
                </div>

                {/* Pricing Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Pricing Model *</label>
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
                          Fixed Price
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        One nightly rate for all guests, regardless of group size.
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        pricingType === 'fixed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>Simple &amp; consistent</span>
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
                          By Guest Count
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Set different nightly prices per number of guests.
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        pricingType === 'per_guest' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>Flexible pricing</span>
                    </button>
                  </div>

                  {/* Fixed price input */}
                  {pricingType === 'fixed' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Nightly Rate (₾) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₾</span>
                        <input
                          type="number"
                          placeholder="e.g. 200"
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          className="w-full p-3 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          min="1"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">This rate applies to all bookings regardless of guest count.</p>
                    </div>
                  )}

                  {/* Per-guest tier inputs */}
                  {pricingType === 'per_guest' && (
                    <div>
                      {maxGuestsNum === 0 ? (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                          <i className="ri-information-line text-amber-500 text-sm"></i>
                          <p className="text-xs text-amber-700">Please select Max Guests in Step 1 first to set up per-guest pricing.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                            <i className="ri-information-line text-amber-500 text-sm"></i>
                            <p className="text-xs text-amber-700 font-medium">
                              Set a nightly price for each guest count. The system picks the right price automatically at booking.
                            </p>
                          </div>
                          <div className="space-y-2">
                            {guestRange.map((n) => (
                              <div key={n} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                                <div className="flex items-center gap-1.5 min-w-[80px]">
                                  <i className="ri-user-line text-gray-400 text-xs"></i>
                                  <span className="text-sm font-medium text-gray-700">
                                    {n} guest{n > 1 ? 's' : ''}
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
                                    placeholder="Price per night"
                                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                  />
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap">/ night</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Accepted Payment Methods *</label>
                  <p className="text-xs text-gray-500 mb-3">Choose how guests can pay for this cottage. You can change this later from your host dashboard.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { value: 'both', label: 'Both', desc: 'Guests choose online or pay at property.', icon: 'ri-bank-card-2-line' },
                      { value: 'online_only', label: 'Online only', desc: 'Card payment only, guests pay when booking.', icon: 'ri-bank-card-line' },
                      { value: 'pay_at_property_only', label: 'Pay at property only', desc: 'Guests pay you on arrival.', icon: 'ri-home-heart-line' },
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
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">First Name *</label>
                    <input
                      type="text"
                      placeholder="Your first name"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-707 mb-2">Last Name *</label>
                    <input
                      type="text"
                      placeholder="Your last name"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">Email Address *</label>
                  <input
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-707 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="+995 xxx xxx xxx"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">What happens next?</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-3">
                        <i className="ri-check-line text-green-500"></i>
                      </div>
                      Our team will review your application within 24 hours
                    </li>
                    <li className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-3">
                        <i className="ri-check-line text-green-500"></i>
                      </div>
                      We'll schedule a property inspection at your convenience
                    </li>
                    <li className="flex items-start">
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 mr-3">
                        <i className="ri-check-line text-green-500"></i>
                      </div>
                      Once approved, your listing goes live and you start earning
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
              Previous
            </button>
            
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 cursor-pointer whitespace-nowrap"
              >
                Next Step
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
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </form>
        </>
        )}

        {/* Benefits Section */}
        <section className="mt-6 md:mt-16 bg-gray-50 rounded-2xl p-4 md:p-8">
          <h2 className="text-base md:text-3xl font-bold text-gray-900 text-center mb-4 md:mb-8">Why host with us?</h2>
          
          <div className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-8">
            {[
              { icon: 'ri-money-dollar-circle-line', title: 'Earn Extra Income', desc: 'Turn your unused space into a profitable income stream with our competitive commission rates' },
              { icon: 'ri-shield-check-line', title: 'Host Protection', desc: 'We provide a secure booking platform and user verification to support safe stays' },
              { icon: 'ri-customer-service-2-line', title: 'Support Available All Week', desc: 'Our dedicated support team is always here to help you succeed as a host' },
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
