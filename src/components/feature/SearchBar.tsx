import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { georgianCities } from '../../mocks/georgian-cities';
import { filterCitiesBilingual, localizePlace } from '../../lib/locationNormalizer';
import { filterPropertiesByName } from '../../lib/propertyNameSearch';
import { useCottageIndex } from '../../hooks/useCottageIndex';
import { useT } from '../../i18n';

export default function SearchBar() {
  const { t, plural, lang } = useT();
  const [showWhereDropdown, setShowWhereDropdown] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2');
  const [showGuestsDropdown, setShowGuestsDropdown] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cottages = useCottageIndex();

  useEffect(() => {
    const urlLocation = searchParams.get('location');
    const urlCheckIn = searchParams.get('checkIn');
    const urlCheckOut = searchParams.get('checkOut');
    const urlGuests = searchParams.get('guests');

    if (urlLocation) setSelectedLocation(urlLocation);
    if (urlCheckIn) setCheckIn(urlCheckIn);
    if (urlCheckOut) setCheckOut(urlCheckOut);
    if (urlGuests) setGuests(urlGuests);
  }, [searchParams]);

  const popularDestinations = [
    { name: 'Tbilisi', description: 'Capital city with rich history' },
    { name: 'Batumi', description: 'Black Sea coastal resort' },
    { name: 'Kutaisi', description: 'Ancient city in western Georgia' },
    { name: 'Mtskheta', description: 'UNESCO World Heritage site' },
    { name: 'Sighnaghi', description: 'City of Love in wine region' },
    { name: 'Gudauri', description: 'Mountain ski resort' },
    { name: 'Borjomi', description: 'Famous for mineral water springs' },
    { name: 'Telavi', description: 'Heart of Kakheti wine region' },
    { name: 'Gori', description: 'Historic city in central Georgia' },
    { name: 'Mestia', description: 'Gateway to Svaneti mountains' },
  ];

  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    setShowWhereDropdown(false);
  };

  // Cottages whose name matches what's typed — shown above the city
  // suggestions so a guest can jump straight to a listing they know by name.
  const matchingCottages = filterPropertiesByName(cottages, selectedLocation).slice(0, 4);

  const handleCottageSelect = (id: string) => {
    setShowWhereDropdown(false);
    navigate(`/property/${id}`);
  };

  /**
   * YYYY-MM-DD from the LOCAL calendar date.
   *
   * Not toISOString(): that converts to UTC first, so east of Greenwich (Tbilisi
   * is UTC+4) it hands back the previous day — which silently let check-out sit
   * on the check-in date, and made "today" yesterday late in the evening.
   */
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = () => toDateStr(new Date());

  /** The day after `date` — a stay has to end later than it starts. */
  const dayAfter = (date: string) => {
    if (!date) return today();
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return toDateStr(d);
  };

  /**
   * Moving check-in past an already-chosen check-out has to drop the check-out.
   * The `min` on the check-out input only constrains what can be picked next —
   * it never re-validates a value chosen earlier, which is how a search could
   * end up checking out before it checked in.
   */
  const handleCheckInChange = (value: string) => {
    setCheckIn(value);
    setCheckOut((prev) => (prev && prev <= value ? '' : prev));
  };

  const handleSearch = () => {
    const newSearchParams = new URLSearchParams();
    if (selectedLocation) newSearchParams.set('location', selectedLocation);
    if (checkIn) newSearchParams.set('checkIn', checkIn);
    // Typing straight into a date field bypasses `min` in most browsers, so the
    // range is checked once more here rather than trusted from the inputs.
    if (checkOut && (!checkIn || checkOut > checkIn)) newSearchParams.set('checkOut', checkOut);
    if (guests) newSearchParams.set('guests', guests);
    const existingCategory = searchParams.get('category');
    if (existingCategory) newSearchParams.set('category', existingCategory);
    navigate(`/search?${newSearchParams.toString()}`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      {/* ── MOBILE LAYOUT (hidden on md+) ── */}
      <div className="block md:hidden w-full space-y-1 px-1">

        {/* Where — single row */}
        <div className="relative bg-white rounded-xl border border-gray-200 shadow-md px-3 py-2.5 flex items-center gap-2">
          <span className="text-xs font-bold text-gray-800 whitespace-nowrap w-16 shrink-0">{t('searchBar.where')}</span>
          <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
          <input
            type="text"
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setShowWhereDropdown(e.target.value.length > 0);
              setShowGuestsDropdown(false);
            }}
            onFocus={() => {
              if (selectedLocation.length > 0) setShowWhereDropdown(true);
              setShowGuestsDropdown(false);
            }}
            onBlur={() => setTimeout(() => setShowWhereDropdown(false), 150)}
            placeholder={t('searchBar.wherePlaceholder')}
            className="text-xs text-gray-600 bg-transparent border-none outline-none flex-1 min-w-0 placeholder-gray-400"
          />
          {selectedLocation && (
            <button
              onMouseDown={(e) => { e.preventDefault(); setSelectedLocation(''); setShowWhereDropdown(false); }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0 cursor-pointer"
            >
              <i className="ri-close-line text-xs"></i>
            </button>
          )}
          {showWhereDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-full max-h-[55vh] overflow-y-auto overscroll-contain bg-white rounded-xl shadow-xl border border-gray-200 z-50 text-left">
              <div className="p-3">
                {selectedLocation.length > 0 ? (
                  <>
                    {matchingCottages.length > 0 && (
                      <div className="mb-3">
                        <h3 className="text-xs font-semibold text-gray-700 mb-2">{t('searchBar.matchingCottages')}</h3>
                        <div className="space-y-1">
                          {matchingCottages.map((cottage) => (
                            <div
                              key={cottage.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleCottageSelect(cottage.id)}
                              className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center mr-2 shrink-0">
                                <i className="ri-home-4-line text-red-500 text-xs"></i>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">{cottage.title}</p>
                                <p className="text-xs text-gray-500 truncate">{cottage.location}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {filterCitiesBilingual(georgianCities, selectedLocation).length > 0 && (
                      <>
                        <h3 className="text-xs font-semibold text-gray-700 mb-2">{t('searchBar.matchingDestinations')}</h3>
                        <div className="space-y-1">
                          {filterCitiesBilingual(georgianCities, selectedLocation)
                            .slice(0, 6)
                            .map((city, index) => (
                              <div
                                key={index}
                                onClick={() =>
                                  handleLocationSelect(
                                    `${localizePlace(city.name, lang)}, ${localizePlace(city.region, lang)}`
                                  )
                                }
                                className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center mr-2 shrink-0">
                                  <i className="ri-map-pin-line text-gray-600 text-xs"></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-gray-900 truncate">{localizePlace(city.name, lang)}</p>
                                  <p className="text-xs text-gray-500">{localizePlace(city.region, lang)}</p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                    {filterCitiesBilingual(georgianCities, selectedLocation).length === 0 && matchingCottages.length === 0 && (
                      <div className="p-2 text-center text-xs text-gray-500">{t('searchBar.noMatches')}</div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">{t('searchBar.popularDestinations')}</h3>
                    <div className="space-y-1">
                      {popularDestinations.map((destination, index) => (
                        <div
                          key={index}
                          onClick={() => handleLocationSelect(localizePlace(destination.name, lang))}
                          className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center mr-2 shrink-0">
                            <i className="ri-map-pin-line text-gray-600 text-xs"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 truncate">{localizePlace(destination.name, lang)}</p>
                            <p className="text-xs text-gray-500 truncate">{destination.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Check-in & Check-out — side by side in one row */}
        <div className="grid grid-cols-2 gap-1">
          {/* Check-in */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-md px-3 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 whitespace-nowrap shrink-0">{t('searchBar.checkInShort')}</span>
            <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
            <div className="flex-1 min-w-0 relative">
              <span className="text-xs text-gray-500 block truncate">
                {checkIn ? formatDate(checkIn) : t('searchBar.addDate')}
              </span>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => handleCheckInChange(e.target.value)}
                min={today()}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
              />
            </div>
          </div>

          {/* Check-out */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-md px-3 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 whitespace-nowrap shrink-0">{t('searchBar.checkOutShort')}</span>
            <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
            <div className="flex-1 min-w-0 relative">
              <span className="text-xs text-gray-500 block truncate">
                {checkOut ? formatDate(checkOut) : t('searchBar.addDate')}
              </span>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn ? dayAfter(checkIn) : today()}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Who — single row */}
        <div
          className="relative bg-white rounded-xl border border-gray-200 shadow-md px-3 py-2.5 flex items-center gap-2 cursor-pointer"
          onClick={() => {
            setShowGuestsDropdown(!showGuestsDropdown);
            setShowWhereDropdown(false);
          }}
        >
          <span className="text-xs font-bold text-gray-800 whitespace-nowrap w-16 shrink-0">{t('searchBar.guests')}</span>
          <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
          <span className="text-xs text-gray-600 flex-1">
            {plural('searchBar.guest', Number(guests) || 0)}
          </span>
          <div className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0">
            <i className="ri-arrow-down-s-line text-sm"></i>
          </div>
          {showGuestsDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 text-left">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{t('searchBar.guests')}</h4>
                    <p className="text-xs text-gray-500">{t('searchBar.agesNote')}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGuests(Math.max(1, parseInt(guests) - 1).toString());
                      }}
                      disabled={guests === '1'}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer ${
                        guests === '1'
                          ? 'border-gray-200 text-gray-300'
                          : 'border-gray-400 text-gray-600 hover:border-gray-600'
                      }`}
                    >
                      <i className="ri-subtract-line text-xs"></i>
                    </button>
                    <span className="w-6 text-center text-sm font-medium" translate="no">{guests}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGuests(Math.min(15, parseInt(guests) + 1).toString());
                      }}
                      disabled={guests === '15'}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer ${
                        guests === '15'
                          ? 'border-gray-200 text-gray-300'
                          : 'border-gray-400 text-gray-600 hover:border-gray-600'
                      }`}
                    >
                      <i className="ri-add-line text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
        >
          <i className="ri-search-line"></i>
          {t('searchBar.search')}
        </button>
      </div>

      {/* ── DESKTOP LAYOUT (hidden below md) ── */}
      {/* No overflow-hidden here: it would clip the Where dropdown. The pill shape
          comes from rounding the first and last cells instead. */}
      <div className="hidden md:grid grid-cols-[1.3fr_1fr_1fr_0.9fr_auto] max-w-[920px] mx-auto bg-white border-[1.5px] border-line rounded-full shadow-card">
        {/* Where */}
        <div className="relative px-5 py-3.5 pl-7 border-r border-line text-left rounded-l-full">
          <div className="text-xs font-semibold text-gray-900 mb-1 uppercase tracking-wide">{t('searchBar.where')}</div>
          <input
            type="text"
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setShowWhereDropdown(e.target.value.length > 0);
              setShowGuestsDropdown(false);
            }}
            onFocus={() => {
              if (selectedLocation.length > 0) setShowWhereDropdown(true);
              setShowGuestsDropdown(false);
            }}
            onBlur={() => setTimeout(() => setShowWhereDropdown(false), 150)}
            placeholder={t('searchBar.wherePlaceholder')}
            className="text-[15px] text-ink bg-transparent border-none outline-none w-full placeholder-gray-400"
          />

          {showWhereDropdown && (
            <div className="absolute top-full left-0 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto overscroll-contain bg-white rounded-xl shadow-xl border border-gray-200 z-50 text-left">
              <div className="p-3">
                {selectedLocation.length > 0 ? (
                  <>
                    {matchingCottages.length > 0 && (
                      <div className="mb-3">
                        <h3 className="text-[13px] font-semibold text-gray-900 mb-2">{t('searchBar.matchingCottages')}</h3>
                        <div className="space-y-1">
                          {matchingCottages.map((cottage) => (
                            <div
                              key={cottage.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleCottageSelect(cottage.id)}
                              className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mr-2.5 shrink-0">
                                <i className="ri-home-4-line text-red-500 text-sm"></i>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{cottage.title}</p>
                                <p className="text-xs text-gray-600 truncate">{cottage.location}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {filterCitiesBilingual(georgianCities, selectedLocation).length > 0 && (
                      <>
                        <h3 className="text-[13px] font-semibold text-gray-900 mb-2">{t('searchBar.matchingDestinations')}</h3>
                        <div className="space-y-1">
                          {filterCitiesBilingual(georgianCities, selectedLocation)
                            .slice(0, 8)
                            .map((city, index) => (
                              <div
                                key={index}
                                onClick={() =>
                                  handleLocationSelect(
                                    `${localizePlace(city.name, lang)}, ${localizePlace(city.region, lang)}`
                                  )
                                }
                                className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-2.5 shrink-0">
                                  <i className="ri-map-pin-line text-gray-600 text-sm"></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{localizePlace(city.name, lang)}</p>
                                  <p className="text-xs text-gray-600">{localizePlace(city.region, lang)}</p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                    {filterCitiesBilingual(georgianCities, selectedLocation).length === 0 && matchingCottages.length === 0 && (
                      <div className="p-2 text-center text-sm text-gray-500">{t('searchBar.noMatches')}</div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-[13px] font-semibold text-gray-900 mb-2">{t('searchBar.popularDestinations')}</h3>
                    <div className="space-y-1">
                      {popularDestinations.map((destination, index) => (
                        <div
                          key={index}
                          onClick={() => handleLocationSelect(localizePlace(destination.name, lang))}
                          className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-2.5 shrink-0">
                            <i className="ri-map-pin-line text-gray-600 text-sm"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{localizePlace(destination.name, lang)}</p>
                            <p className="text-xs text-gray-600 truncate">{destination.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Check-in */}
        <div className="px-5 py-3.5 border-r border-line text-left">
          <div className="text-xs font-semibold text-gray-900 mb-1 uppercase tracking-wide">{t('searchBar.checkIn')}</div>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => handleCheckInChange(e.target.value)}
            min={today()}
            className="text-[15px] text-ink bg-transparent border-none outline-none w-full cursor-pointer"
            placeholder="Add dates"
          />
        </div>

        {/* Check-out */}
        <div className="px-5 py-3.5 border-r border-line text-left">
          <div className="text-xs font-semibold text-gray-900 mb-1 uppercase tracking-wide">{t('searchBar.checkOut')}</div>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            min={checkIn ? dayAfter(checkIn) : today()}
            className="text-[15px] text-ink bg-transparent border-none outline-none w-full cursor-pointer"
            placeholder="Add dates"
          />
        </div>

        {/* Who */}
        <div className="relative px-5 py-3.5 text-left">
          <div
            className="cursor-pointer"
            onClick={() => {
              setShowGuestsDropdown(!showGuestsDropdown);
              setShowWhereDropdown(false);
            }}
          >
            <div className="text-xs font-semibold text-gray-900 mb-1 uppercase tracking-wide">{t('searchBar.guests')}</div>
            <div className="text-[15px] text-ink">
              {plural('searchBar.guest', Number(guests) || 0)}
            </div>
          </div>

          {showGuestsDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 text-left">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{t('searchBar.guests')}</h4>
                    <p className="text-xs text-gray-600">{t('searchBar.agesNote')}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setGuests(Math.max(1, parseInt(guests) - 1).toString())}
                      disabled={guests === '1'}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ${
                        guests === '1'
                          ? 'border-gray-200 text-gray-300'
                          : 'border-gray-400 text-gray-600 hover:border-gray-600'
                      }`}
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-subtract-line"></i>
                      </div>
                    </button>
                    <span className="w-8 text-center font-medium" translate="no">{guests}</span>
                    <button
                      onClick={() => setGuests(Math.min(15, parseInt(guests) + 1).toString())}
                      disabled={guests === '15'}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ${
                        guests === '15'
                          ? 'border-gray-200 text-gray-300'
                          : 'border-gray-400 text-gray-600 hover:border-gray-600'
                      }`}
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-add-line"></i>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          aria-label={t('searchBar.search')}
          className="bg-red-500 hover:bg-red-600 text-white font-bold text-base w-[52px] flex items-center justify-center cursor-pointer transition-colors whitespace-nowrap rounded-r-full"
        >
          <i className="ri-search-line text-lg"></i>
        </button>
      </div>
    </>
  );
}
