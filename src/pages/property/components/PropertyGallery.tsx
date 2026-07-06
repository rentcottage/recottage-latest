import { useState, useEffect, useCallback } from 'react';
import { optimizedImageUrl, IMG_HERO, IMG_THUMB } from '../../../lib/imageUrl';

interface PropertyGalleryProps {
  images: string[];
  title: string;
}

export default function PropertyGallery({ images, title }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
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
      <div className="mb-8 space-y-3">

        {/* Main Image — 16:9, clickable → lightbox */}
        <div
          className="relative w-full overflow-hidden rounded-xl bg-gray-100 cursor-zoom-in group"
          style={{ aspectRatio: '16 / 9' }}
          onClick={() => openLightbox(activeIndex)}
        >
          <img
            key={activeIndex}
            src={optimizedImageUrl(safeImages[activeIndex], IMG_HERO, 75)}
            alt={`${title} — photo ${activeIndex + 1}`}
            fetchPriority={activeIndex === 0 ? 'high' : undefined}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300"
          />

          {/* Overlay hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 text-white text-sm font-medium px-4 py-2 rounded-full flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-zoom-in-line"></i>
              </div>
              View full screen
            </div>
          </div>

          {/* Photo counter badge */}
          {safeImages.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {activeIndex + 1} / {safeImages.length}
            </div>
          )}

          {/* "View all photos" button */}
          {safeImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); openLightbox(activeIndex); }}
              className="absolute bottom-3 left-3 bg-white text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-image-2-line"></i>
              </div>
              View all {safeImages.length} photos
            </button>
          )}
        </div>

        {/* Thumbnail Strip — 4:3 each, horizontal scroll */}
        {safeImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {safeImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200 focus:outline-none ${
                  idx === activeIndex
                    ? 'ring-2 ring-red-500 ring-offset-1 opacity-100'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{ width: 100, aspectRatio: '4 / 3' }}
                aria-label={`View photo ${idx + 1}`}
              >
                <img
                  src={optimizedImageUrl(img, IMG_THUMB, 60)}
                  alt={`${title} thumbnail ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {idx === activeIndex && (
                  <div className="absolute inset-0 bg-red-500/10"></div>
                )}
              </button>
            ))}
          </div>
        )}
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
              alt={`${title} — photo ${lightboxIndex + 1}`}
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
                    alt={`Thumbnail ${idx + 1}`}
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
