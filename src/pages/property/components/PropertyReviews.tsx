import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface Review {
  id: string;
  booking_id: string | null;
  property_id: string;
  guest_email: string;
  guest_name: string | null;
  rating: number;
  review_text: string | null;
  created_at: string;
}

interface Props {
  propertyId: string;
  isDbProperty: boolean;
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`flex items-center justify-center ${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`}>
          <i className={`${s <= rating ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'} ${size === 'lg' ? 'text-base' : 'text-sm'}`}></i>
        </div>
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="w-8 h-8 flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
        >
          <i className={`text-xl ${(hover || value) >= s ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'}`}></i>
        </button>
      ))}
    </div>
  );
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

// Static mock reviews for mock properties
const MOCK_REVIEWS: Review[] = [
  { id: 'm1', booking_id: null, property_id: 'mock', guest_email: 'sarah@example.com', guest_name: 'Sarah M.', rating: 5, review_text: 'Absolutely magical place! The views were breathtaking and the host was incredibly welcoming. Every detail was perfect — from the cozy fireplace to the fresh mountain air.', created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  { id: 'm2', booking_id: null, property_id: 'mock', guest_email: 'james@example.com', guest_name: 'James R.', rating: 5, review_text: 'Perfect getaway spot. Very clean, well-equipped, and the location is ideal for exploring the surrounding area. We loved every minute of our stay.', created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: 'm3', booking_id: null, property_id: 'mock', guest_email: 'maria@example.com', guest_name: 'Maria L.', rating: 4, review_text: 'Beautiful cottage with authentic Georgian charm. Highly recommend for a peaceful retreat. The local food recommendations from the host were a bonus!', created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
  { id: 'm4', booking_id: null, property_id: 'mock', guest_email: 'david@example.com', guest_name: 'David K.', rating: 5, review_text: 'Exceeded our expectations in every way. The photos don\'t do it justice — even more beautiful in person. Will definitely be back next summer!', created_at: new Date(Date.now() - 120 * 86400000).toISOString() },
];

export default function PropertyReviews({ propertyId, isDbProperty }: Props) {
  const { user, isLoggedIn } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hasEligibleBooking, setHasEligibleBooking] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [eligibleBookingId, setEligibleBookingId] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    if (!isDbProperty) {
      setReviews(MOCK_REVIEWS);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    setReviews((data ?? []) as Review[]);
    setLoading(false);
  }, [propertyId, isDbProperty]);

  const checkEligibility = useCallback(async () => {
    if (!isLoggedIn || !user?.email || !isDbProperty) return;

    // Check if user has a confirmed or completed booking for this property
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('property_id', propertyId)
      .eq('user_email', user.email)
      .in('status', ['confirmed', 'completed'])
      .limit(1);

    if (!bookings || bookings.length === 0) return;
    const bookingId = bookings[0].id;
    setEligibleBookingId(bookingId);

    // Check if already reviewed this property
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('property_id', propertyId)
      .eq('guest_email', user.email)
      .maybeSingle();

    setHasEligibleBooking(true);
    setAlreadyReviewed(!!existingReview);
  }, [isLoggedIn, user?.email, propertyId, isDbProperty]);

  useEffect(() => {
    fetchReviews();
    checkEligibility();
  }, [fetchReviews, checkEligibility]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !reviewText.trim() || rating === 0) return;
    setSubmitting(true);

    const meta = user.user_metadata ?? {};
    const guestName = (meta.full_name ?? meta.name ?? `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim()) || user.email.split('@')[0];

    const { error } = await supabase.from('reviews').insert({
      booking_id: eligibleBookingId,
      property_id: propertyId,
      guest_email: user.email,
      guest_name: guestName,
      rating,
      review_text: reviewText.trim(),
    });

    if (error) {
      setSubmitStatus('error');
    } else {
      setSubmitStatus('success');
      setAlreadyReviewed(true);
      setShowForm(false);
      setReviewText('');
      setRating(5);
      fetchReviews();
    }
    setSubmitting(false);
  };

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-40 mb-4" />
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 md:mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
            <i className="ri-star-fill text-yellow-400 text-sm md:text-base"></i>
          </div>
          <h3 className="text-sm md:text-xl font-semibold text-gray-900">
            {reviews.length > 0 ? `${avgRating} · ${reviews.length} review${reviews.length !== 1 ? 's' : ''}` : 'No reviews yet'}
          </h3>
        </div>
        {isDbProperty && isLoggedIn && hasEligibleBooking && !alreadyReviewed && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs md:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center">
              <i className="ri-edit-line"></i>
            </div>
            {showForm ? 'Cancel' : 'Write a Review'}
          </button>
        )}
        {isDbProperty && alreadyReviewed && (
          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 md:px-3 py-1 md:py-1.5 rounded-full">
            <i className="ri-checkbox-circle-line"></i>
            <span className="hidden sm:inline">You reviewed this property</span>
            <span className="sm:hidden">Reviewed</span>
          </span>
        )}
      </div>

      {/* Success toast */}
      {submitStatus === 'success' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 md:px-4 py-2.5 md:py-3 mb-4 text-xs md:text-sm text-green-800">
          <i className="ri-checkbox-circle-line text-green-600"></i>
          Thank you! Your review has been submitted.
        </div>
      )}

      {/* Leave Review Form */}
      {showForm && isLoggedIn && (
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 mb-4 md:mb-6 border border-gray-200">
          <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-3 md:mb-4">Your Review</h4>
          <form onSubmit={handleSubmitReview} className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Rating</label>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Your experience <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
                placeholder="Share your experience — what did you love about this place?"
                rows={4}
                maxLength={500}
                required
                className="w-full text-xs md:text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{reviewText.length}/500</p>
            </div>
            {submitStatus === 'error' && (
              <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !reviewText.trim()}
                className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs md:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? (
                  <>
                    <div className="w-3 h-3 flex items-center justify-center animate-spin">
                      <i className="ri-loader-4-line"></i>
                    </div>
                    Submitting…
                  </>
                ) : 'Submit Review'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs md:text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rating distribution (only when there are reviews) */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-4 md:mb-8">
          {/* Distribution bars */}
          <div className="space-y-1.5 md:space-y-2">
            {ratingDist.map(({ star, count }) => {
              const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 md:gap-3">
                  <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-star-fill text-yellow-400 text-xs"></i>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-6">{count}</span>
                </div>
              );
            })}
          </div>
          {/* Average display */}
          <div className="flex flex-col items-center justify-center py-2 md:py-4">
            <p className="text-4xl md:text-5xl font-bold text-gray-900 mb-1.5 md:mb-2">{avgRating}</p>
            <StarDisplay rating={Math.round(avgRating)} size="lg" />
            <p className="text-xs text-gray-400 mt-1.5 md:mt-2">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {reviews.length === 0 && (
        <div className="flex flex-col items-center py-8 md:py-12 text-gray-400">
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center mb-2">
            <i className="ri-star-line text-2xl md:text-3xl"></i>
          </div>
          <p className="text-xs md:text-sm text-gray-600 font-medium">No reviews yet</p>
          {isDbProperty && isLoggedIn && hasEligibleBooking && !alreadyReviewed && (
            <p className="text-xs mt-1">Be the first to leave a review!</p>
          )}
        </div>
      )}

      {/* Reviews grid */}
      {reviews.length > 0 && (() => {
        const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 2);
        const hasMore = reviews.length > 2;
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
              {visibleReviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 md:pb-5">
                  <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs md:text-sm font-bold text-gray-600">
                        {(review.guest_name || review.guest_email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-xs md:text-sm">{review.guest_name || review.guest_email.split('@')[0]}</p>
                      <p className="text-xs text-gray-400">{timeAgo(review.created_at)}</p>
                    </div>
                  </div>
                  <StarDisplay rating={review.rating} />
                  {review.review_text && (
                    <p className="text-xs md:text-sm text-gray-700 mt-1.5 md:mt-2 leading-relaxed">{review.review_text}</p>
                  )}
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setShowAllReviews((v) => !v)}
                className="mt-4 md:mt-5 flex items-center gap-1.5 text-xs md:text-sm font-semibold text-gray-900 underline underline-offset-2 cursor-pointer whitespace-nowrap md:no-underline md:border md:border-gray-300 md:rounded-lg md:px-4 md:py-2 md:hover:bg-gray-50 md:transition-colors"
              >
                {showAllReviews ? (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-arrow-up-s-line"></i>
                    </div>
                    Show fewer reviews
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-arrow-down-s-line"></i>
                    </div>
                    Show all {reviews.length} reviews
                  </>
                )}
              </button>
            )}
          </>
        );
      })()}
    </div>
  );
}
