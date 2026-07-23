import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';

// Local production assets (no Unsplash hotlinking — see public/redesign/).
const EXTERIOR = "url('/redesign/hero-exterior.jpg')";
const INTERIOR = "url('/redesign/hero-interior.jpg')";

// Golden-hour grade applied to the interior view when the sunset toggle is on.
const SUNSET_FILTER = 'sepia(.3) saturate(1.35) hue-rotate(-12deg) brightness(.92) contrast(1.05)';

// Amenity quick-filters. Each maps to a real value the /search page filters on
// (searchParams `amenities`, substring-matched) so every chip is a live filter,
// never a dead control. Source copy stays English — Google Translate localizes
// it at runtime like the rest of the app.
const HERO_CHIPS: { label: string; amenity: string }[] = [
  { label: 'Hot tub', amenity: 'Hot Tub' },
  { label: 'Fireplace', amenity: 'Fireplace' },
  { label: 'Mountain view', amenity: 'Mountain View' },
  { label: 'Swimming pool', amenity: 'Swimming Pool' },
  { label: 'Pet-friendly', amenity: 'Pet Friendly' },
];

type Phase = 'out' | 'crossfade' | 'in';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Cinematic landing hero (ported from the landing-redesign mockup).
 *
 * Timeline: an exterior mountain shot does a slow Ken Burns push-in, then at 2s
 * the view crossfades — as if stepping indoors — to an interior looking back out
 * a window, and at 2.5s the headline + live search reveal. Users with
 * prefers-reduced-motion skip straight to the final "inside" state, so search is
 * available immediately and nothing animates.
 */
export default function CinematicHero() {
  const navigate = useNavigate();
  // Reduced-motion users start (and stay) on the functional "inside" state.
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'in' : 'out'));
  const [sunset, setSunset] = useState(false);
  const [playId, setPlayId] = useState(0); // bump to restart the Ken Burns intro
  const timers = useRef<number[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (prefersReducedMotion()) {
      setPhase('in'); // no motion → land on the functional state immediately
      return;
    }
    setPhase('out');
    setPlayId((n) => n + 1);
    timers.current.push(window.setTimeout(() => setPhase('crossfade'), 2000));
    timers.current.push(window.setTimeout(() => setPhase('in'), 2500));
  }, []);

  useEffect(() => {
    play();
    return () => timers.current.forEach(clearTimeout);
  }, [play]);

  const imageInside = phase !== 'out';
  const showSearch = phase === 'in';

  return (
    <section
      className="relative w-full min-h-[100svh] overflow-hidden"
      aria-label="Find your cottage in Georgia"
    >
      {/* ── Image layers ── */}
      {/* Exterior (Ken Burns push-in). Keyed by playId so Replay restarts it. */}
      <div
        key={playId}
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center rc-kenburns transition-opacity duration-700"
        style={{ backgroundImage: EXTERIOR, opacity: imageInside ? 0 : 1 }}
      />
      {/* Blurred interior underlay — fills the frame while the sharp layer settles. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: INTERIOR,
          filter: 'blur(28px) brightness(.55)',
          transform: 'scale(1.1)',
          opacity: imageInside ? 1 : 0,
        }}
      />
      {/* Sharp interior — settles from a soft blur, takes the golden-hour grade. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-cover bg-center transition-[opacity,filter] duration-700 ${
          imageInside ? 'rc-settle' : ''
        }`}
        style={{
          backgroundImage: INTERIOR,
          opacity: imageInside ? 1 : 0,
          filter: sunset ? SUNSET_FILTER : undefined,
        }}
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

      {/* ── Stage: outside intro line, then the inside headline + live search ── */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-center">
        {/* Outside intro — decorative lead-in (kept out of the heading outline). */}
        <div
          aria-hidden={showSearch}
          className={`absolute px-4 transition-opacity duration-500 ${
            showSearch ? 'opacity-0 pointer-events-none' : 'rc-fadein'
          }`}
        >
          <div
            className="text-xs font-extrabold uppercase text-white/80"
            style={{ letterSpacing: '.35em' }}
          >
            Outside · Nature
          </div>
          <div
            className="mt-3 font-extrabold text-white leading-[1.15] text-[clamp(34px,5.5vw,60px)]"
            style={{ textShadow: '0 2px 18px rgba(0,0,0,.45)' }}
          >
            Your cottage in the Caucasus mountains
          </div>
        </div>

        {/* Inside — the real headline + search. Mounted throughout (so it is
            present for prerender/SEO); revealed with a rise once we're inside. */}
        <div
          inert={!showSearch}
          className={`w-full flex flex-col items-center ${
            showSearch ? '' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className={showSearch ? 'rc-rise' : ''}>
            <div
              className="text-xs font-extrabold uppercase text-white/80"
              style={{ letterSpacing: '.35em' }}
            >
              Inside · Comfort
            </div>
            <h1
              className="mt-3 font-extrabold text-white leading-[1.15] text-[clamp(34px,5.5vw,60px)]"
              style={{ textShadow: '0 2px 18px rgba(0,0,0,.45)' }}
            >
              Wake up to this view
            </h1>
          </div>

          {/* Live search card + amenity quick-filters */}
          <div
            className={`w-full max-w-[900px] mx-auto mt-8 ${showSearch ? 'rc-rise' : ''}`}
            style={showSearch ? { animationDelay: '.35s' } : undefined}
          >
            <SearchBar />
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {HERO_CHIPS.map((chip) => (
                <button
                  key={chip.amenity}
                  type="button"
                  onClick={() => navigate(`/search?amenities=${encodeURIComponent(chip.amenity)}`)}
                  className="rounded-full border border-white/40 bg-black/25 backdrop-blur-sm text-white text-xs font-bold px-[15px] py-[7px] hover:bg-black/40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {chip.label}
                </button>
              ))}
            </div>
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
        Golden hour
      </button>

      <button
        type="button"
        onClick={play}
        className="hidden md:inline-flex items-center gap-1.5 absolute bottom-6 right-6 z-20 rounded-full border border-white/30 bg-black/30 text-white text-xs font-bold px-4 py-2.5 backdrop-blur-sm hover:bg-black/50 transition-colors cursor-pointer"
      >
        <i className="ri-restart-line" aria-hidden="true" />
        Replay intro
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
