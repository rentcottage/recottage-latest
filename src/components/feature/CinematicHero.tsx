import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';
import HeroPromoBanner from './HeroPromoBanner';
import { useT } from '../../i18n';

// Local production asset (no Unsplash hotlinking — see public/redesign/).
const INTERIOR = "url('/redesign/hero-interior.jpg')";

// Golden-hour grade applied to the interior view when the sunset toggle is on.
const SUNSET_FILTER = 'sepia(.3) saturate(1.35) hue-rotate(-12deg) brightness(.92) contrast(1.05)';

// Amenity quick-filters. Each maps to a real value the /search page filters on
// (searchParams `amenities`, substring-matched) so every chip is a live filter,
// never a dead control. `labelKey` resolves via the i18n catalog at render.
const HERO_CHIPS: { labelKey: string; amenity: string }[] = [
  { labelKey: 'hero.chipHotTub', amenity: 'Hot Tub' },
  { labelKey: 'hero.chipFireplace', amenity: 'Fireplace' },
  { labelKey: 'hero.chipMountainView', amenity: 'Mountain View' },
  { labelKey: 'hero.chipSwimmingPool', amenity: 'Swimming Pool' },
  { labelKey: 'hero.chipPetFriendly', amenity: 'Pet Friendly' },
];

/**
 * Landing hero: the interior view looking back out a window, with the headline
 * and live search on top.
 *
 * No intro sequence — the exterior shot, the Ken Burns push-in and the
 * crossfade were removed, so the hero renders in its final state on first
 * paint and search is usable immediately. The golden-hour grade stays as an
 * opt-in toggle.
 */
export default function CinematicHero() {
  const navigate = useNavigate();
  const { t } = useT();
  const [sunset, setSunset] = useState(false);

  return (
    <section
      className="relative w-full min-h-[100svh] overflow-hidden"
      aria-label="Find your cottage in Georgia"
    >
      {/* ── Image layer — static interior, takes the golden-hour grade ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center transition-[filter] duration-700"
        style={{ backgroundImage: INTERIOR, filter: sunset ? SUNSET_FILTER : undefined }}
      />

      {/* ── Overlays: shade + vignette for legible white text, sunset wash ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.25) 45%,rgba(0,0,0,.6))' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.45) 100%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-opacity duration-[1200ms]"
        style={{
          background:
            'linear-gradient(180deg,rgba(255,150,60,.28) 0%,rgba(255,90,70,.18) 45%,rgba(120,50,90,.22) 100%)',
          opacity: sunset ? 1 : 0,
        }}
      />

      {/* ── Stage: headline + live search, shown immediately ── */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full flex flex-col items-center">
          <div>
            <div
              className="text-xs font-extrabold uppercase text-white/80"
              style={{ letterSpacing: '.35em' }}
            >
              {t('hero.insideLabel')}
            </div>
            <h1
              className="mt-3 font-extrabold text-white leading-[1.15] text-[clamp(34px,5.5vw,60px)]"
              style={{ textShadow: '0 2px 18px rgba(0,0,0,.45)' }}
            >
              {t('hero.insideTitle')}
            </h1>
          </div>

          {/* Live search card + amenity quick-filters */}
          <div className="w-full max-w-[900px] mx-auto mt-8">
            <SearchBar />
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {HERO_CHIPS.map((chip) => (
                <button
                  key={chip.amenity}
                  type="button"
                  onClick={() => navigate(`/search?amenities=${encodeURIComponent(chip.amenity)}`)}
                  className="rounded-full border border-white/40 bg-black/25 backdrop-blur-sm text-white text-xs font-bold px-[15px] py-[7px] hover:bg-black/40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t(chip.labelKey)}
                </button>
              ))}
            </div>
            {/* Active offers — nothing renders when none is running. */}
            <HeroPromoBanner />
          </div>
        </div>
      </div>

      {/* ── Delight controls (desktop only, kept subordinate) ── */}
      <button
        type="button"
        onClick={() => setSunset((s) => !s)}
        aria-pressed={sunset}
        className={`hidden md:inline-flex items-center gap-1.5 absolute bottom-6 left-6 z-20 rounded-full border text-xs font-bold px-4 py-2.5 backdrop-blur-sm transition-colors cursor-pointer ${
          sunset
            ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
            : 'bg-black/30 border-white/30 text-white hover:bg-black/50'
        }`}
      >
        <i className="ri-sun-line" aria-hidden="true" />
        {t('hero.goldenHour')}
      </button>

      <div
        aria-hidden="true"
        className="hidden md:block absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-white/70"
      >
        <i className="ri-arrow-down-line text-xl rc-bob inline-block" />
      </div>
    </section>
  );
}
