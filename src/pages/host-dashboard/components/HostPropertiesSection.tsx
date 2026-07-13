import { useState } from 'react';
import { useTranslation, translateVocab } from '@lib/i18n';
import HostPropertyEditModal from './HostPropertyEditModal';

interface GuestPricingTier {
  min_guests: number;
  max_guests: number;
  price_per_night: number;
}

interface Property {
  id: string;
  title: string;
  location: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  price_per_night: number;
  status: 'pending' | 'approved' | 'rejected';
  amenities: string[];
  photo_urls: string[];
  cover_photo_url?: string | null;
  cover_photo_position?: string | null;
  description: string;
  created_at: string;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  booking_approval_mode?: string | null;
  pricing_type?: string | null;
  guest_pricing_tiers?: GuestPricingTier[] | null;
}

interface Props {
  properties: Property[];
  loading: boolean;
  onRefresh?: () => void;
}

function statusBadge(s: string) {
  if (s === 'approved') return 'bg-green-100 text-green-700';
  if (s === 'rejected') return 'bg-red-100 text-red-600';
  return 'bg-amber-100 text-amber-700';
}

function statusIcon(s: string) {
  if (s === 'approved') return 'ri-checkbox-circle-line';
  if (s === 'rejected') return 'ri-close-circle-line';
  return 'ri-time-line';
}

function statusMessageKey(s: string) {
  if (s === 'approved') return 'host.properties.statusLiveOnSite';
  if (s === 'rejected') return 'host.properties.statusNotApproved';
  return 'host.properties.statusAwaitingReview';
}

function approvalModeBadge(mode: string | null | undefined) {
  if (mode === 'auto_confirm') return { cls: 'bg-emerald-100 text-emerald-700', icon: 'ri-flashlight-line', labelKey: 'host.properties.autoConfirm' };
  return { cls: 'bg-amber-100 text-amber-700', icon: 'ri-time-line', labelKey: 'host.properties.manualApproval' };
}

export default function HostPropertiesSection({ properties, loading, onRefresh }: Props) {
  const { t, lang } = useTranslation();
  const [selectedPhoto, setSelectedPhoto] = useState<{ urls: string[]; index: number } | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const statusLabel = (s: string) => {
    const key = `common.status.${s}`;
    const out = t(key);
    return out === key ? s : out;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t('host.dashboard.nav.myProperties')}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{t('host.properties.subtitle')}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-card border border-line shadow-card overflow-hidden animate-pulse">
              <div className="h-40 md:h-48 bg-gray-100" />
              <div className="p-4 md:p-5 space-y-3">
                <div className="h-5 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-card border border-line shadow-card flex flex-col items-center py-20 text-gray-400">
          <div className="w-14 h-14 flex items-center justify-center mb-4">
            <i className="ri-home-smile-line text-5xl"></i>
          </div>
          <p className="text-sm font-medium text-gray-700">{t('host.properties.noPropertiesYet')}</p>
          <p className="text-xs mt-1 mb-6">{t('host.properties.noPropertiesHint')}</p>
          <a
            href="/become-host"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line"></i>
            </div>
            {t('host.properties.listYourCottage')}
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {properties.map((p) => (
            <div key={p.id} className="bg-white rounded-card border border-line shadow-card overflow-hidden">
              {/* Photo area */}
              {p.photo_urls && p.photo_urls.length > 0 ? (
                <div className="relative h-40 md:h-48 overflow-hidden">
                  <img
                    src={p.cover_photo_url || p.photo_urls[0]}
                    alt={p.title}
                    className="w-full h-full object-cover object-top"
                  />
                  {p.cover_photo_url && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500/90 text-white text-xs font-semibold px-2 py-1 rounded-full">
                      <i className="ri-star-fill text-[10px]"></i>
                      {t('host.properties.cover')}
                    </div>
                  )}
                  {p.photo_urls.length > 1 && (
                    <button
                      onClick={() => setSelectedPhoto({ urls: p.photo_urls, index: 0 })}
                      className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap hover:bg-black/80 transition-colors"
                    >
                      <div className="w-3 h-3 flex items-center justify-center">
                        <i className="ri-image-line"></i>
                      </div>
                      {t('host.properties.photosCount', { count: p.photo_urls.length })}
                    </button>
                  )}
                </div>
              ) : (
                <div className="h-40 md:h-48 bg-gray-50 flex items-center justify-center">
                  <div className="w-10 h-10 flex items-center justify-center">
                    <i className="ri-home-line text-gray-300 text-4xl"></i>
                  </div>
                </div>
              )}

              {/* Status bar */}
              <div className={`px-5 py-2.5 flex items-center gap-2 ${
                p.status === 'approved' ? 'bg-green-50 border-b border-green-100' :
                p.status === 'rejected' ? 'bg-red-50 border-b border-red-100' :
                'bg-amber-50 border-b border-amber-100'
              }`}>
                <i className={`${statusIcon(p.status)} text-sm ${
                  p.status === 'approved' ? 'text-green-600' :
                  p.status === 'rejected' ? 'text-red-500' : 'text-amber-600'
                }`}></i>
                <p className="text-xs text-gray-600">{t(statusMessageKey(p.status))}</p>
                <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge(p.status)}`}>
                  {statusLabel(p.status)}
                </span>
              </div>

              {/* Content */}
              <div className="p-4 md:p-5">
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <div className="min-w-0 mr-3">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm md:text-base font-bold text-gray-900 notranslate min-w-0 truncate" translate="no">{p.title}</h3>
                      <button
                        onClick={() => setEditingProperty(p)}
                        title={t('host.properties.editName')}
                        aria-label={t('host.properties.editCottageName')}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                    </div>
                    <p className="text-xs md:text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                      <i className="ri-map-pin-line text-xs"></i>
                      {p.location}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base md:text-lg font-bold text-gray-900">₾{p.price_per_night}</p>
                    <p className="text-xs text-gray-400">{t('common.perNight')}</p>
                  </div>
                </div>

                {/* Specs */}
                <div className="flex items-center flex-wrap gap-2 md:gap-4 text-xs text-gray-500 mb-2 md:mb-3">
                  <span className="flex items-center gap-1">
                    <i className="ri-hotel-bed-line"></i>
                    {t('common.beds', { count: p.bedrooms })}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-drop-line"></i>
                    {t('common.baths', { count: p.bathrooms })}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-group-line"></i>
                    {t('common.guests', { count: p.max_guests })}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <i className="ri-price-tag-3-line"></i>
                    {translateVocab(t, 'propertyType', p.property_type)}
                  </span>
                </div>

                {/* Description */}
                {p.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{p.description}</p>
                )}

                {/* Amenities */}
                {p.amenities && p.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.amenities.slice(0, 5).map((a) => (
                      <span key={a} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {translateVocab(t, 'amenities', a)}
                      </span>
                    ))}
                    {p.amenities.length > 5 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                        {t('host.properties.moreAmenities', { count: p.amenities.length - 5 })}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer: submitted date + edit button */}
                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-gray-400">
                      {t('host.properties.submittedOn', { date: new Date(p.created_at).toLocaleDateString(lang, { day: '2-digit', month: 'long', year: 'numeric' }) })}
                    </p>
                    {(() => {
                      const mb = approvalModeBadge(p.booking_approval_mode);
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${mb.cls}`}>
                          <i className={`${mb.icon} text-xs`}></i>
                          {t(mb.labelKey)}
                        </span>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setEditingProperty(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-edit-line"></i>
                    </div>
                    {t('host.properties.editSettings')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-80">
              <img
                src={selectedPhoto.urls[selectedPhoto.index]}
                alt={t('host.properties.propertyPhotoAlt')}
                className="w-full h-full object-cover object-top"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
              {selectedPhoto.urls.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedPhoto((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : null)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                  >
                    <i className="ri-arrow-left-line text-sm"></i>
                  </button>
                  <button
                    onClick={() => setSelectedPhoto((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : null)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                  >
                    <i className="ri-arrow-right-line text-sm"></i>
                  </button>
                </>
              )}
            </div>
            {selectedPhoto.urls.length > 1 && (
              <div className="flex gap-2 p-4 overflow-x-auto">
                {selectedPhoto.urls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhoto((prev) => prev ? { ...prev, index: i } : null)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      i === selectedPhoto.index ? 'ring-2 ring-emerald-500' : 'opacity-60 hover:opacity-90'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit property modal */}
      {editingProperty && (
        <HostPropertyEditModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSaved={() => {
            setEditingProperty(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
