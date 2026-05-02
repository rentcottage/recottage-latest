import { useState, useRef, useCallback } from 'react';

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
  isRealListing,
  coverPosition = 'center',
  onFavoriteClick,
}: PropertyImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const MIN_SWIPE_DISTANCE = 40;

  const safeImages = images.length > 0 ? images : [''];
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
      className="relative w-full overflow-hidden bg-gray-100 select-none"
      style={{ aspectRatio: '16/11', minHeight: '180px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image strip — only render current + adjacent for performance */}
      {safeImages.map((src, i) => {
        const isActive = i === currentIndex;
        const isAdjacent =
          i === (currentIndex + 1) % total ||
          i === (currentIndex - 1 + total) % total;

        if (!isActive && !isAdjacent) return null;

        return (
          <img
            key={i}
            src={src}
            alt={`${title} - photo ${i + 1}`}
            loading={i === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${i === 0 ? positionClass[coverPosition] : 'object-center'}`}
            style={{ opacity: isActive ? 1 : 0, pointerEvents: 'none', transform: 'scale(1.01)' }}
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
