import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../../i18n';

interface Review {
  id: string;
  property_id: string;
  guest_email: string;
  guest_name: string | null;
  rating: number;
  review_text: string | null;
  created_at: string;
}

interface Property {
  id: string;
  title: string;
}

interface Props {
  properties: Property[];
  loading: boolean;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="w-3.5 h-3.5 flex items-center justify-center">
          <i className={`text-xs ${s <= rating ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'}`}></i>
        </div>
      ))}
    </div>
  );
}

export default function HostReviewsSection({ properties, loading: propsLoading }: Props) {
  const { t } = useT();

  function timeAgo(d: string): string {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t('host.reviews.today');
    if (days === 1) return t('host.reviews.yesterday');
    if (days < 30) return t('host.reviews.daysAgoShort', { count: days });
    const months = Math.floor(days / 30);
    if (months < 12) return t('host.reviews.monthsAgoShort', { count: months });
    return t('host.reviews.yearsAgoShort', { count: Math.floor(months / 12) });
  }

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchReviews = useCallback(async () => {
    if (propsLoading || properties.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const propertyIds = properties.map((p) => p.id);
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false });
    setReviews((data ?? []) as Review[]);
    setLoading(false);
  }, [properties, propsLoading]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.title]));

  const filtered = filter === 'all' ? reviews : reviews.filter((r) => r.property_id === filter);

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const perPropertyStats = properties.map((p) => {
    const propReviews = reviews.filter((r) => r.property_id === p.id);
    const avg = propReviews.length > 0
      ? Math.round((propReviews.reduce((s, r) => s + r.rating, 0) / propReviews.length) * 10) / 10
      : 0;
    return { ...p, reviewCount: propReviews.length, avg };
  });

  return (
    <div>
      <div className="mb-5 md:mb-6">
        <h2 className="text-base md:text-xl font-bold text-gray-900">{t('host.reviews.title')}</h2>
        <p className="text-xs md:text-sm text-gray-400 mt-0.5">{t('host.reviews.sub')}</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6">
        <div className="bg-white rounded-card border border-line shadow-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-xs md:text-sm text-gray-500">{t('host.reviews.overallRating')}</span>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
              <i className="ri-star-fill text-yellow-500 text-xs md:text-sm"></i>
            </div>
          </div>
          {loading ? (
            <div className="h-6 md:h-8 bg-gray-100 rounded animate-pulse w-16 mb-1" />
          ) : (
            <p className="text-xl md:text-3xl font-bold text-gray-900 mb-1">{reviews.length > 0 ? avgRating : '—'}</p>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {reviews.length > 0 && (
              <>
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="w-3 h-3 flex items-center justify-center">
                    <i className={`text-xs ${s <= Math.round(avgRating) ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'}`}></i>
                  </div>
                ))}
              </>
            )}
            <span className="text-xs text-gray-400">{t('host.reviews.fromReviewsCount', { count: reviews.length })}</span>
          </div>
        </div>

        <div className="bg-white rounded-card border border-line shadow-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-xs md:text-sm text-gray-500">{t('host.reviews.totalReviews')}</span>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <i className="ri-chat-3-line text-gray-600 text-xs md:text-sm"></i>
            </div>
          </div>
          <p className="text-xl md:text-3xl font-bold text-gray-900 mb-1">{loading ? '—' : reviews.length}</p>
          <p className="text-xs text-gray-400">{t('host.reviews.acrossAllProperties')}</p>
        </div>

        <div className="bg-white rounded-card border border-line shadow-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-xs md:text-sm text-gray-500">{t('host.reviews.fiveStarReviews')}</span>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <i className="ri-thumb-up-line text-emerald-600 text-xs md:text-sm"></i>
            </div>
          </div>
          <p className="text-xl md:text-3xl font-bold text-gray-900 mb-1">
            {loading ? '—' : reviews.filter((r) => r.rating === 5).length}
          </p>
          <p className="text-xs text-gray-400">
            {reviews.length > 0
              ? t('host.reviews.percentOfAllReviews', { pct: Math.round((reviews.filter((r) => r.rating === 5).length / reviews.length) * 100) })
              : t('host.reviews.noReviewsYetLower')}
          </p>
        </div>
      </div>

      {/* Per-property ratings */}
      {perPropertyStats.length > 0 && (
        <div className="bg-white rounded-card border border-line shadow-card p-4 md:p-5 mb-5 md:mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 md:mb-4">{t('host.reviews.ratingPerProperty')}</h3>
          <div className="space-y-3">
            {perPropertyStats.map((p) => (
              <div key={p.id} className="flex items-center gap-3 md:gap-4">
                <p className="text-xs md:text-sm text-gray-700 w-28 md:w-48 truncate flex-shrink-0 notranslate" translate="no">{p.title}</p>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: p.reviewCount > 0 ? `${(p.avg / 5) * 100}%` : '0%' }}
                  />
                </div>
                <div className="flex items-center gap-1 md:gap-1.5 w-20 md:w-24 flex-shrink-0">
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-star-fill text-yellow-400 text-xs"></i>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{p.reviewCount > 0 ? p.avg : '—'}</span>
                  <span className="text-xs text-gray-400">({p.reviewCount})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews list */}
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {/* Filter tabs */}
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-gray-100 gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto flex-1 min-w-0">
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${filter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t('host.reviews.all')}
              <span className={`text-xs font-bold ${filter === 'all' ? 'text-gray-600' : 'text-gray-400'}`}>{reviews.length}</span>
            </button>
            {properties.map((p) => {
              const count = reviews.filter((r) => r.property_id === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setFilter(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${filter === p.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span className="max-w-[100px] truncate notranslate" translate="no">{p.title}</span>
                  <span className={`text-xs font-bold ${filter === p.id ? 'text-yellow-600' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={fetchReviews}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap flex-shrink-0 ml-2"
          >
            <div className="w-3 h-3 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
            {t('host.reviews.refresh')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 flex items-center justify-center animate-spin"><i className="ri-loader-4-line"></i></div>
              <span className="text-sm">{t('host.reviews.loadingReviews')}</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="w-10 h-10 flex items-center justify-center mb-2">
              <i className="ri-star-line text-3xl"></i>
            </div>
            <p className="text-sm">{t('host.reviews.noReviewsYet')}</p>
            <p className="text-xs mt-1">{t('host.reviews.noReviewsSub')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <div key={r.id} className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs md:text-sm font-bold text-gray-600">
                      {(r.guest_name || r.guest_email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-semibold text-gray-900">
                          {r.guest_name || r.guest_email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{propertyMap[r.property_id] || t('host.reviews.unknownProperty')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StarDisplay rating={r.rating} />
                        <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                    {r.review_text && (
                      <p className="text-xs md:text-sm text-gray-700 mt-1.5 md:mt-2 leading-relaxed">{r.review_text}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
