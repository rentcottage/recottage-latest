import { useState, useEffect, useCallback } from 'react';
import { optimizedImageUrl, IMG_HERO, IMG_THUMB, IMG_CARD } from '../../../lib/imageUrl';
import { useTranslation } from '@lib/i18n';

interface PropertyGalleryProps {
  images: string[];
  title: string;
}

export default function PropertyGallery({ images, title }: PropertyGalleryProps) {
  const { t } = useTranslation();
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Self-hosted placeholder — old readdy.ai fallback URL 400s (dead endpoint).
  const safeImages = images && images.length > 0 ? images : ['/cottage-placeholder.svg'];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const closeLightbox = () => setShowLightbox(false);

  const lightboxNext = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % safeImages.length);
  }, [safeImages.length]);

  const lightboxPrev = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
  }, [safeImages.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!showLightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') lightboxNext();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showLightbox, lightboxNext, lightboxPrev]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (showLightbox) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showLightbox]);

  return (
    <>
      {/* ── Main Gallery ─────────────────────────────────────────── */}
      <div className="mb-8">
        {/* Mosaic grid (mockup): big main image + 2×2 smaller tiles. The
            tiles only render when there are enough photos to fill them (≥5);
            with fewer, the main image spans full width so there are never
            blank cells. Tiles are desktop-only; mobile shows the main image
            alone. Any tile opens the lightbox at that photo. */}
        <div className={`grid grid-cols-1 gap-2.5 rounded-card overflow-hidden h-64 md:h-[390px] ${safeImages.length >= 5 ? 'md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2' : ''}`}>

          {/* Main image — spans both rows when the mosaic tiles are shown */}
          <div
            className={`relative h-full overflow-hidden bg-gray-100 cursor-zoom-in group ${safeImages.length >= 5 ? 'md:row-span-2' : ''}`}
            onClick={() => openLightbox(0)}
          >
            <img
              src={optimizedImageUrl(safeImages[0], IMG_HERO, 75)}
              alt={t('property.gallery.photoAlt', { title, number: 1 })}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />

            {/* "View all photos" button */}
            {safeImages.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); openLightbox(0); }}
                className="absolute bottom-3.5 right-3.5 bg-white text-gray-800 text-[13px] font-bold px-4 py-2 rounded-[10px] flex items-center gap-1.5 hover:bg-gray-50 transition-colors shadow-card whitespace-nowrap cursor-pointer"
              >
                <i className="ri-image-2-line"></i>
                {t('property.gallery.allPhotos', { count: safeImages.length })}
              </button>
            )}
          </div>

          {/* 4 smaller tiles — desktop only, only when ≥5 photos to fill them */}
          {safeImages.length >= 5 && safeImages.slice(1, 5).map((img, i) => (
            <div
              key={i + 1}
              className="relative hidden md:block h-full overflow-hidden bg-gray-100 cursor-zoom-in group"
              onClick={() => openLightbox(i + 1)}
            >
              <img
                src={optimizedImageUrl(img, IMG_CARD, 65)}
                alt={t('property.gallery.photoAlt', { title, number: i + 2 })}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={closeLightbox}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white/80 text-sm font-medium">
              {title}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/60 text-sm">
                {lightboxIndex + 1} / {safeImages.length}
              </span>
              <button
                onClick={closeLightbox}
                className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
          </div>

          {/* Main image area */}
          <div
            className="flex-1 flex items-center justify-center relative px-16 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={lightboxIndex}
              src={safeImages[lightboxIndex]}
              alt={t('property.gallery.photoAlt', { title, number: lightboxIndex + 1 })}
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: 'calc(100vh - 200px)' }}
            />

            {/* Prev arrow */}
            {safeImages.length > 1 && (
              <button
                onClick={lightboxPrev}
                className="absolute left-4 w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line text-xl"></i>
              </button>
            )}

            {/* Next arrow */}
            {safeImages.length > 1 && (
              <button
                onClick={lightboxNext}
                className="absolute right-4 w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
              >
                <i className="ri-arrow-right-line text-xl"></i>
              </button>
            )}
          </div>

          {/* Bottom thumbnail strip */}
          {safeImages.length > 1 && (
            <div
              className="flex-shrink-0 px-6 py-4 flex justify-center gap-2 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {safeImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative flex-shrink-0 rounded-md overflow-hidden transition-all duration-150 focus:outline-none ${
                    idx === lightboxIndex
                      ? 'ring-2 ring-white opacity-100'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                  style={{ width: 72, aspectRatio: '4 / 3' }}
                >
                  <img
                    src={optimizedImageUrl(img, IMG_THUMB, 60)}
                    alt={t('property.gallery.thumbnailAlt', { number: idx + 1 })}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
