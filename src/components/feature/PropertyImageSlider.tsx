import { useState, useRef, useCallback } from 'react';
import StoragePhoto from './StoragePhoto';
import { useT } from '../../i18n';

/** What the data layer substitutes for a listing with no photos. */
const NO_PHOTO = '/cottage-placeholder.svg';

type CoverPosition = 'top' | 'center' | 'bottom';

interface PropertyImageSliderProps {
  images: string[];
  title: string;
  isRealListing?: boolean;
  coverPosition?: CoverPosition;
  onFavoriteClick: (e: React.MouseEvent) => void;
}

export default function PropertyImageSlider({
  images,
  title,
  coverPosition = 'center',
  onFavoriteClick,
}: PropertyImageSliderProps) {
  const { t } = useT();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  // Adjacent slides are only mounted after the user shows slider intent
  // (hover/touch). Before that each card downloads exactly ONE image —
  // upfront it was three (current + both neighbours), tripling page weight.
  const [wantsNeighbors, setWantsNeighbors] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const MIN_SWIPE_DISTANCE = 40;

  // No photos (or only the placeholder) → show the skeleton, not an <img>.
  const realImages = images.filter((u) => u && u !== NO_PHOTO);
  const safeImages = realImages.length > 0 ? realImages : [''];
  const total = safeImages.length;

  const positionClass: Record<CoverPosition, string> = {
    top: 'object-top',
    center: 'object-center',
    bottom: 'object-bottom',
  };

  const goTo = useCallback(
    (index: number, e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      setCurrentIndex((index + total) % total);
    },
    [total]
  );

  const goPrev = useCallback(
    (e: React.MouseEvent) => goTo(currentIndex - 1, e),
    [currentIndex, goTo]
  );

  const goNext = useCallback(
    (e: React.MouseEvent) => goTo(currentIndex + 1, e),
    [currentIndex, goTo]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    setWantsNeighbors(true);
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) >= MIN_SWIPE_DISTANCE) {
      if (delta > 0) {
        setCurrentIndex((prev) => (prev + 1) % total);
      } else {
        setCurrentIndex((prev) => (prev - 1 + total) % total);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const maxDots = 5;
  const showDots = total > 1;

  return (
    <div
      className="relative w-full aspect-[4/3] overflow-hidden bg-[#f1eee8] select-none"
      onMouseEnter={() => { setIsHovered(true); setWantsNeighbors(true); }}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Soft placeholder under every photo: visible while a photo loads, if it
          fails, and for listings with no photos. StoragePhoto never paints a
          broken icon or alt text, so this is all a failed photo ever shows. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[#bdb5a7]">
        <i aria-hidden="true" className="ri-home-4-line text-[28px] leading-none" />
        {realImages.length === 0 && <span className="text-[11px] font-medium">{t('search.cardNoPhoto')}</span>}
      </div>

      {/* Image strip — active always; neighbours only after slider intent.
          Each photo is the 400px WebP variant (falls back to the original),
          cropped to the 4:3 card by object-cover; a host-positioned cover
          (top/bottom) keeps their crop position. Zooms slightly on card
          hover (desktop), not under reduced motion. */}
      {safeImages.map((src, i) => {
        const isActive = i === currentIndex;
        const isAdjacent =
          i === (currentIndex + 1) % total ||
          i === (currentIndex - 1 + total) % total;

        if (!isActive && !(wantsNeighbors && isAdjacent)) return null;

        const isPositionedCover = i === 0 && coverPosition !== 'center';
        if (!src) return null;
        return (
          <StoragePhoto
            key={i}
            src={src}
            size="thumb"
            alt={`${title} - photo ${i + 1}`}
            width={400}
            height={300}
            className={`absolute inset-0 w-full h-full object-cover transition-[opacity,scale] duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${isPositionedCover ? positionClass[coverPosition] : 'object-center'}`}
            style={{ opacity: isActive ? 1 : 0, pointerEvents: 'none' }}
          />
        );
      })}

      {/* Favorite button */}
      <button
        onClick={onFavoriteClick}
        className="absolute top-2 right-2 md:top-3 md:right-3 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-colors z-10 cursor-pointer"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-heart-line text-gray-600 hover:text-red-500 text-sm"></i>
        </div>
      </button>

      {/* Arrow buttons — desktop hover only */}
      {total > 1 && (
        <>
          <button
            onClick={goPrev}
            className={`
              hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10
              w-7 h-7 items-center justify-center
              bg-white/90 hover:bg-white rounded-full
              transition-opacity duration-200 cursor-pointer
              ${isHovered ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-s-line text-gray-800 text-base leading-none"></i>
            </div>
          </button>

          <button
            onClick={goNext}
            className={`
              hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10
              w-7 h-7 items-center justify-center
              bg-white/90 hover:bg-white rounded-full
              transition-opacity duration-200 cursor-pointer
              ${isHovered ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-right-s-line text-gray-800 text-base leading-none"></i>
            </div>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {showDots && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {safeImages.slice(0, maxDots).map((_, i) => {
            const isLastDot = i === maxDots - 1 && total > maxDots;
            const isActive = isLastDot ? currentIndex >= maxDots - 1 : i === currentIndex;
            return (
              <button
                key={i}
                onClick={(e) => goTo(i, e)}
                className={`
                  rounded-full transition-all duration-200 cursor-pointer
                  ${isActive
                    ? 'w-4 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90'}
                `}
              />
            );
          })}
        </div>
      )}

      {/* Photo counter badge — shows on mobile when total > 1 */}
      {total > 1 && (
        <div className="md:hidden absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full z-10">
          {currentIndex + 1}/{total}
        </div>
      )}
    </div>
  );
}
