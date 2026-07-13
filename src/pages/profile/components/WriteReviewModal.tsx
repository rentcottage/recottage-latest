import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '@lib/i18n';

interface WriteReviewModalProps {
  propertyId: string;
  propertyTitle: string;
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(0);
  const labels = [
    '',
    t('profile.review.rating1'),
    t('profile.review.rating2'),
    t('profile.review.rating3'),
    t('profile.review.rating4'),
    t('profile.review.rating5'),
  ];
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="w-9 h-9 flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
          >
            <i className={`text-2xl ${(hover || value) >= s ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'}`}></i>
          </button>
        ))}
      </div>
      {(hover || value) > 0 && (
        <p className="text-xs text-gray-500 mt-1.5 font-medium">{labels[hover || value]}</p>
      )}
    </div>
  );
}

export default function WriteReviewModal({
  propertyId,
  propertyTitle,
  bookingId,
  onClose,
  onSuccess,
}: WriteReviewModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !reviewText.trim() || rating === 0) return;
    setSubmitting(true);
    setError(null);

    const meta = user.user_metadata ?? {};
    const guestName =
      (meta.full_name ?? meta.name ?? `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim()) ||
      user.email.split('@')[0];

    const { error: insertError } = await supabase.from('reviews').insert({
      booking_id: bookingId,
      property_id: propertyId,
      guest_email: user.email,
      guest_name: guestName,
      rating,
      review_text: reviewText.trim(),
    });

    if (insertError) {
      setError(t('common.errorTryAgain'));
    } else {
      onSuccess();
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t('profile.review.writeReview')}</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{propertyTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer text-gray-400 hover:text-gray-600"
          >
            <i className="ri-close-line text-base"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {/* Rating */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              {t('profile.review.overallRating')} <span className="text-red-400">*</span>
            </label>
            <StarPicker value={rating} onChange={setRating} />
          </div>

          {/* Review text */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              {t('profile.review.yourExperience')} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
              placeholder={t('profile.review.placeholder')}
              rows={5}
              maxLength={500}
              required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none text-gray-800 placeholder-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{reviewText.length}/500</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <i className="ri-error-warning-line"></i>
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || !reviewText.trim() || rating === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-loader-4-line animate-spin"></i>
                  </div>
                  {t('common.submitting')}
                </>
              ) : (
                <>
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-star-fill text-yellow-400 text-xs"></i>
                  </div>
                  {t('profile.review.submitReview')}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
