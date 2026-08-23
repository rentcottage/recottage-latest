import { useEffect, useState } from 'react';
import { useT } from '../../../i18n';
import {
  fetchActivitiesForProperty, CATEGORY_EMOJI, formatDuration, formatGel,
  type PropertyActivity,
} from '../../../lib/propertyActivities';

/**
 * "What this host offers" — masterclasses, degustation, tours, horse riding
 * and the like, on the cottage detail page.
 *
 * Renders nothing when the host has added none, so every existing cottage page
 * is unchanged. These are arranged directly with the host: the prices are
 * informational and never touch the booking total (bog-payment recomputes it
 * from nightly rate x nights and would reject anything else).
 */
// INVARIANT: this component takes `propertyId` and nothing else, and returns
// no value to its parent. That is deliberate — activities are paid directly to
// the host, so no activity price may ever reach the booking widget. Do not add
// a price callback or an onTotalChange prop here. If a future version needs to
// charge for activities, bog-payment's server-side price verification has to
// learn about them FIRST, otherwise every booking fails with PRICE_MISMATCH.
export default function PropertyActivities({ propertyId }: { propertyId: string }) {
  const { t } = useT();
  const [activities, setActivities] = useState<PropertyActivity[]>([]);

  useEffect(() => {
    if (!propertyId) { setActivities([]); return; }
    let cancelled = false;
    fetchActivitiesForProperty(propertyId).then((a) => { if (!cancelled) setActivities(a); });
    return () => { cancelled = true; };
  }, [propertyId]);

  if (activities.length === 0) return null;

  const priceLabel = (a: PropertyActivity): string => {
    if (a.price_unit === 'on_request') return t('property.activities.onRequest');
    if (a.price_unit === 'free') return t('property.activities.free');
    const amount = `₾${formatGel(Number(a.price ?? 0))}`;
    return a.price_unit === 'per_group'
      ? t('property.activities.perGroup', { amount })
      : t('property.activities.perPerson', { amount });
  };

  return (
    <div className="mb-6 md:mb-8">
      <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-1">{t('property.activities.title')}</h2>
      <p className="text-sm text-gray-500 mb-4">{t('property.activities.sub')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activities.map((a) => (
          <div key={a.id} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white">
            {a.image_url && (
              <div
                className="h-36 bg-gray-100"
                style={{ backgroundImage: `url('${a.image_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                role="img"
                aria-label={a.title}
              />
            )}
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-2xl leading-none flex-shrink-0" aria-hidden="true">{CATEGORY_EMOJI[a.category]}</span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-gray-900 leading-snug">{a.title}</h3>
                  <p className="text-xs text-gray-400">{t(`property.activities.cat_${a.category}`)}</p>
                </div>
              </div>

              {a.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{a.description}</p>
              )}

              <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
                {/* Numbers carry no language — notranslate keeps Google Translate
                    from wrapping them in <font> tags React can't then update. */}
                <span className="text-sm font-bold text-gray-900 notranslate" translate="no">{priceLabel(a)}</span>
                {formatDuration(a.duration_minutes) && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <i className="ri-time-line"></i>{formatDuration(a.duration_minutes)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5 flex-shrink-0"></i>
        <span>{t('property.activities.arrangeNote')}</span>
      </p>
    </div>
  );
}
