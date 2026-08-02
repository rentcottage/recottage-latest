import { useNavigate, useSearchParams } from 'react-router-dom';
import PropertyImageSlider from './PropertyImageSlider';
import { useT } from '../../i18n';

interface PropertyCardProps {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  host: string;
  amenities: string[];
  isRealListing?: boolean;
  coverPosition?: 'top' | 'center' | 'bottom';
}

export default function PropertyCard({
  id,
  title,
  location,
  price,
  rating,
  reviews,
  image,
  images,
  host,
  amenities,
  isRealListing,
  coverPosition,
}: PropertyCardProps) {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleCardClick = () => {
    const currentParams = new URLSearchParams();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const guests = searchParams.get('guests');
    if (checkIn) currentParams.set('checkIn', checkIn);
    if (checkOut) currentParams.set('checkOut', checkOut);
    if (guests) currentParams.set('guests', guests);
    const queryString = currentParams.toString();
    const url = queryString ? `/property/${id}?${queryString}` : `/property/${id}`;
    navigate(url);
  };

  const photoList = images && images.length > 0 ? images : [image];

  // Limit amenities shown on desktop to 2, mobile to 1 (cards are narrow in the grid)
  const desktopAmenities = amenities.slice(0, 2);
  const desktopExtra = amenities.length - 2;
  const mobileAmenities = amenities.slice(0, 1);
  const mobileExtra = amenities.length - 1;

  return (
    <div
      className="group bg-white rounded-card overflow-hidden cursor-pointer shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 flex flex-col"
      onClick={handleCardClick}
    >
      {/* Image + verified tag overlay */}
      <div className="relative">
        <PropertyImageSlider
          images={photoList}
          title={title}
          isRealListing={isRealListing}
          coverPosition={coverPosition}
          onFavoriteClick={(e) => e.stopPropagation()}
        />
        {isRealListing && (
          <span className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1 bg-[#222] text-white text-[11.5px] font-bold px-2.5 py-1 rounded-full pointer-events-none">
            <i className="ri-verified-badge-fill text-[12px] leading-none"></i>
            {t('search.badgeVerified')}
          </span>
        )}
      </div>

      {/* Card body — flex column so price always sticks to bottom */}
      <div className="p-3 md:p-[18px] flex flex-col flex-1 min-h-0">

        {/* Title row with rating */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-bold text-ink text-sm md:text-[16.5px] leading-snug notranslate line-clamp-2 flex-1 min-w-0"
            translate="no"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {title}
          </h3>
          {/* Only shown once a listing has real reviews. `rating` is hardcoded to
              5.0 in the data layer, so with zero reviews there is nothing real to show. */}
          {reviews > 0 && (
            <div className="flex items-center flex-shrink-0 mt-0.5 text-red-500 font-bold text-xs md:text-[13.5px] whitespace-nowrap">
              <i className="ri-star-fill text-[11px] md:text-xs mr-0.5"></i>
              <span translate="no">{rating}</span>
              <span className="ml-0.5 font-semibold" translate="no">({reviews})</span>
            </div>
          )}
        </div>

        {/* Location — single line, truncated */}
        <p className="text-xs md:text-[13.5px] text-soft mb-1.5 truncate leading-tight">{location}</p>

        {/* Host — desktop only */}
        <p className="hidden md:block text-xs text-gray-400 mb-2.5 truncate">{t('property.detail.hostedBy', { host })}</p>

        {/* Amenities — desktop */}
        <div className="hidden md:flex items-center gap-1.5 mb-3 flex-nowrap overflow-hidden">
          {desktopAmenities.map((amenity, index) => (
            <span
              key={index}
              className="text-xs bg-[#fafafa] border border-line text-gray-600 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 max-w-[120px] truncate"
            >
              {amenity}
            </span>
          ))}
          {desktopExtra > 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
              +{desktopExtra}
            </span>
          )}
        </div>

        {/* Amenities — mobile */}
        <div className="flex md:hidden items-center gap-1 mb-2 flex-nowrap overflow-hidden">
          {mobileAmenities.map((amenity, index) => (
            <span
              key={index}
              className="text-xs bg-[#fafafa] border border-line text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 max-w-[100px] truncate"
            >
              {amenity}
            </span>
          ))}
          {mobileExtra > 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
              +{mobileExtra}
            </span>
          )}
        </div>

        {/* Spacer pushes price to bottom */}
        <div className="flex-1" />

        {/* Price row */}
        <div className="flex items-baseline gap-1 pt-2.5">
          <span className="text-base md:text-[18px] font-extrabold text-ink whitespace-nowrap" translate="no">₾{price}</span>
          <span className="text-xs text-soft whitespace-nowrap">/ night</span>
        </div>
      </div>
    </div>
  );
}
