import { useEffect, useState } from 'react';
import AutocompleteInput from '../base/AutocompleteInput';
import { georgianCities } from '../../mocks/georgian-cities';
import { localizePlace } from '../../lib/locationNormalizer';
import { HOST_REGIONS, REGION_LABEL_KEY } from '../../lib/regions';
import { useT } from '../../i18n';

interface LocationPickerProps {
  city: string;
  region: string;
  onCityChange: (city: string) => void;
  onRegionChange: (region: string) => void;
  className?: string;
}

/**
 * Where a listing is, as two structured fields rather than one free-text line.
 *
 * The host names the city, then confirms its region. Picking a city from the
 * catalog fills the region in automatically — the second field is a check, not
 * extra typing — but it stays editable, which is what makes an unlisted village
 * filterable: it still lands in a real region instead of nowhere.
 *
 * The pair is joined back into the canonical "City, Region" string by the
 * caller, so everything downstream (geocoding, region matching, search) reads
 * exactly the shape it always has.
 *
 * Language: the STORED city stays the catalog's canonical English name, while
 * the host reads and picks in their own language. The two are kept apart on
 * purpose — localizing what is stored would leave the same city filed under a
 * different spelling depending on who happened to submit it.
 */
export default function LocationPicker({
  city,
  region,
  onCityChange,
  onRegionChange,
  className = '',
}: LocationPickerProps) {
  const { t, lang } = useT();

  // What the host sees in the city box. Diverges from the stored value only
  // after a catalog pick — free text is shown back exactly as typed, so the
  // field never rewrites itself under someone mid-word.
  const [cityDisplay, setCityDisplay] = useState(() => localizePlace(city, lang));

  /** True once the stored city is a catalog entry — the displayed name is then
      a translation of it, which no string comparison against the English
      catalog would recognise. */
  const cityIsResolved = georgianCities.some(
    (c) => c.name.toLowerCase() === city.trim().toLowerCase(),
  );

  // A known city follows the language switcher; anything else is left alone.
  useEffect(() => {
    const known = georgianCities.some((c) => c.name.toLowerCase() === city.trim().toLowerCase());
    if (known) setCityDisplay(localizePlace(city, lang));
  }, [lang, city]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      <AutocompleteInput
        label={t('account.becomeHost.cityLabel')}
        placeholder={t('account.becomeHost.locationPlaceholder')}
        value={cityDisplay}
        onChange={(value) => {
          // Typed freely: what is shown and what is stored are the same text.
          setCityDisplay(value);
          onCityChange(value);
        }}
        // Store the canonical name. Its region has its own field, so writing
        // "Batumi, Adjara" here would only duplicate it.
        formatSelection={(option) => option.name}
        // Runs after onChange, so this is what settles the displayed text:
        // the city reads in the host's language while the canonical name is
        // what gets stored.
        onOptionSelect={(option) => {
          setCityDisplay(localizePlace(option.name, lang));
          onCityChange(option.name);
          onRegionChange(option.region);
        }}
        optionLabel={(option) => ({
          name: localizePlace(option.name, lang),
          region: t(REGION_LABEL_KEY[option.region] || option.region),
        })}
        customLabel={(typed) => ({
          title: t('account.becomeHost.customUse', { value: typed }),
          hint: t('account.becomeHost.customHint'),
        })}
        options={georgianCities}
        resolved={cityIsResolved}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('account.becomeHost.regionLabel')} <span className="text-red-500">*</span>
        </label>
        <select
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-8 text-sm"
          required
        >
          <option value="">{t('account.becomeHost.regionPlaceholder')}</option>
          {HOST_REGIONS.map((r) => (
            <option key={r} value={r}>
              {t(REGION_LABEL_KEY[r] || r)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1.5">{t('account.becomeHost.regionHint')}</p>
      </div>
    </div>
  );
}
