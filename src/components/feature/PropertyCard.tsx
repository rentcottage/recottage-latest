import { useNavigate, useSearchParams } from 'react-router-dom';
import PropertyImageSlider from './PropertyImageSlider';

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

  // Limit amenities shown on desktop to 2, mobile to 1
  const desktopAmenities = amenities.slice(0, 2);
  const desktopExtra = amenities.length - 2;
  const mobileAmenities = amenities.slice(0, 1);
  const mobileExtra = amenities.length - 1;

  return (
    <div
      className="bg-white rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-300 flex flex-col"
      onClick={handleCardClick}
    >
      {/* Image */}
      <PropertyImageSlider
        images={photoList}
        title={title}
        isRealListing={isRealListing}
        coverPosition={coverPosition}
        onFavoriteClick={(e) => e.stopPropagation()}
      />

      {/* Card body — flex column so price always sticks to bottom */}
      <div className="p-3 md:p-4 flex flex-col flex-1 min-h-0">

        {/* Title row with rating */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-semibold text-gray-900 text-sm md:text-[15px] leading-snug notranslate line-clamp-2 flex-1 min-w-0"
            translate="no"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {title}
          </h3>
          <div className="flex items-center flex-shrink-0 mt-0.5">
            <i className="ri-star-fill text-yellow-400 text-xs"></i>
            <span className="text-xs text-gray-900 font-medium ml-0.5">{rating}</span>
            <span className="hidden md:inline text-xs text-gray-400 ml-0.5">({reviews})</span>
          </div>
        </div>

        {/* Location — single line, truncated */}
        <p className="text-xs text-gray-500 mb-1.5 truncate leading-tight">{location}</p>

        {/* Host — desktop only */}
        <p className="hidden md:block text-xs text-gray-400 mb-2 truncate">Hosted by {host}</p>

        {/* Amenities — desktop */}
        <div className="hidden md:flex items-center gap-1 mb-3 flex-nowrap overflow-hidden">
          {desktopAmenities.map((amenity, index) => (
            <span
              key={index}
              className="text-xs bg-stone-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 max-w-[120px] truncate"
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
              className="text-xs bg-stone-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 max-w-[100px] truncate"
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
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-baseline gap-0.5 min-w-0">
            <span className="text-sm md:text-base font-bold text-gray-900 whitespace-nowrap">₾{price}</span>
            <span className="text-xs text-gray-400 ml-0.5 whitespace-nowrap">/ night</span>
          </div>
          {isRealListing && (
            <span className="hidden md:inline text-xs text-green-600 font-medium whitespace-nowrap ml-2">Verified</span>
          )}
        </div>
      </div>
    </div>
  );
}
