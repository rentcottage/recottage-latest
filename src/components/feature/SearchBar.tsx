import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { georgianCities } from '../../mocks/georgian-cities';
import { filterCitiesBilingual } from '../../lib/locationNormalizer';

export default function SearchBar() {
  const [showWhereDropdown, setShowWhereDropdown] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2');
  const [showGuestsDropdown, setShowGuestsDropdown] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  const handleSearch = () => {
    const newSearchParams = new URLSearchParams();
    if (selectedLocation) newSearchParams.set('location', selectedLocation);
    if (checkIn) newSearchParams.set('checkIn', checkIn);
    if (checkOut) newSearchParams.set('checkOut', checkOut);
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
          <span className="text-xs font-bold text-gray-800 whitespace-nowrap w-16 shrink-0">Where</span>
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
            placeholder="Search destinations"
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
            <div className="absolute top-full left-0 mt-1.5 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50">
              <div className="p-3">
                {selectedLocation.length > 0 ? (
                  <>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Matching destinations</h3>
                    <div className="space-y-1">
                      {filterCitiesBilingual(georgianCities, selectedLocation)
                        .slice(0, 6)
                        .map((city, index) => (
                          <div
                            key={index}
                            onClick={() => handleLocationSelect(`${city.name}, ${city.region}`)}
                            className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center mr-2 shrink-0">
                              <i className="ri-map-pin-line text-gray-600 text-xs"></i>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900">{city.name}</p>
                              <p className="text-xs text-gray-500">{city.region}</p>
                            </div>
                          </div>
                        ))}
                      {filterCitiesBilingual(georgianCities, selectedLocation).length === 0 && (
                        <div className="p-2 text-center text-xs text-gray-500">No destinations found</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Popular destinations</h3>
                    <div className="space-y-1">
                      {popularDestinations.map((destination, index) => (
                        <div
                          key={index}
                          onClick={() => handleLocationSelect(destination.name)}
                          className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center mr-2 shrink-0">
                            <i className="ri-map-pin-line text-gray-600 text-xs"></i>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900">{destination.name}</p>
                            <p className="text-xs text-gray-500">{destination.description}</p>
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
            <span className="text-xs font-bold text-gray-800 whitespace-nowrap shrink-0">In</span>
            <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
            <div className="flex-1 min-w-0 relative">
              <span className="text-xs text-gray-500 block truncate">
                {checkIn ? formatDate(checkIn) : 'Add date'}
              </span>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
              />
            </div>
          </div>

          {/* Check-out */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-md px-3 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 whitespace-nowrap shrink-0">Out</span>
            <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
            <div className="flex-1 min-w-0 relative">
              <span className="text-xs text-gray-500 block truncate">
                {checkOut ? formatDate(checkOut) : 'Add date'}
              </span>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || new Date().toISOString().split('T')[0]}
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
          <span className="text-xs font-bold text-gray-800 whitespace-nowrap w-16 shrink-0">Guests</span>
          <div className="w-px h-3.5 bg-gray-300 shrink-0"></div>
          <span className="text-xs text-gray-600 flex-1">
            {guests} guest{guests !== '1' ? 's' : ''}
          </span>
          <div className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0">
            <i className="ri-arrow-down-s-line text-sm"></i>
          </div>
          {showGuestsDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Guests</h4>
                    <p className="text-xs text-gray-500">Ages 13 or above</p>
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
                    <span className="w-6 text-center text-sm font-medium">{guests}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGuests(Math.min(12, parseInt(guests) + 1).toString());
                      }}
                      disabled={guests === '12'}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer ${
                        guests === '12'
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
          Search
        </button>
      </div>

      {/* ── DESKTOP LAYOUT (hidden below md) ── */}
      <div className="hidden md:block bg-white rounded-full shadow-lg border border-gray-200 p-2">
        <div className="flex flex-row items-center">
          {/* Where */}
          <div className="relative flex-1 min-w-0">
            <div className="px-6 py-4">
              <div className="text-xs font-semibold text-gray-900 mb-1">Where</div>
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
                placeholder="Search destinations"
                className="text-sm text-gray-600 bg-transparent border-none outline-none w-full placeholder-gray-400"
              />
            </div>

            {showWhereDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                <div className="p-4">
                  {selectedLocation.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Matching destinations</h3>
                      <div className="space-y-2">
                        {filterCitiesBilingual(georgianCities, selectedLocation)
                          .slice(0, 8)
                          .map((city, index) => (
                            <div
                              key={index}
                              onClick={() => handleLocationSelect(`${city.name}, ${city.region}`)}
                              className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                                <i className="ri-map-pin-line text-gray-600"></i>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{city.name}</p>
                                <p className="text-sm text-gray-600">{city.region}</p>
                              </div>
                            </div>
                          ))}
                        {filterCitiesBilingual(georgianCities, selectedLocation).length === 0 && (
                          <div className="p-3 text-center text-gray-500">No destinations found</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular destinations</h3>
                      <div className="space-y-2">
                        {popularDestinations.map((destination, index) => (
                          <div
                            key={index}
                            onClick={() => handleLocationSelect(destination.name)}
                            className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                              <i className="ri-map-pin-line text-gray-600"></i>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{destination.name}</p>
                              <p className="text-sm text-gray-600">{destination.description}</p>
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

          <div className="w-px h-8 bg-gray-300"></div>

          {/* Check-in */}
          <div className="flex-1 min-w-0">
            <div className="px-6 py-4">
              <div className="text-xs font-semibold text-gray-900 mb-1">Check-in</div>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="text-sm text-gray-600 bg-transparent border-none outline-none w-full cursor-pointer"
                placeholder="Add dates"
              />
            </div>
          </div>

          <div className="w-px h-8 bg-gray-300"></div>

          {/* Check-out */}
          <div className="flex-1 min-w-0">
            <div className="px-6 py-4">
              <div className="text-xs font-semibold text-gray-900 mb-1">Check-out</div>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || new Date().toISOString().split('T')[0]}
                className="text-sm text-gray-600 bg-transparent border-none outline-none w-full cursor-pointer"
                placeholder="Add dates"
              />
            </div>
          </div>

          <div className="w-px h-8 bg-gray-300"></div>

          {/* Who */}
          <div className="relative flex-1 min-w-0">
            <div
              className="px-6 py-4 cursor-pointer rounded-full hover:bg-gray-50 transition-colors"
              onClick={() => {
                setShowGuestsDropdown(!showGuestsDropdown);
                setShowWhereDropdown(false);
              }}
            >
              <div className="text-xs font-semibold text-gray-900 mb-1">Guests</div>
              <div className="text-sm text-gray-600">
                {guests} guest{guests !== '1' ? 's' : ''}
              </div>
            </div>

            {showGuestsDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Guests</h4>
                      <p className="text-sm text-gray-600">Ages 13 or above</p>
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
                      <span className="w-8 text-center font-medium">{guests}</span>
                      <button
                        onClick={() => setGuests(Math.min(12, parseInt(guests) + 1).toString())}
                        disabled={guests === '12'}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ${
                          guests === '12'
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
          <div className="ml-2">
            <button
              onClick={handleSearch}
              className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full cursor-pointer transition-colors whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-search-line"></i>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
