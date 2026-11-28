import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';
import HeroPromoBanner from './HeroPromoBanner';
import { useT } from '../../i18n';

// Golden-hour grade applied to the hero media when the sunset toggle is on.
const SUNSET_FILTER = 'sepia(.3) saturate(1.35) hue-rotate(-12deg) brightness(.92) contrast(1.05)';

// Amenity quick-filters. Each maps to a real value the /search page filters on
// (searchParams `amenities`, substring-matched) so every chip is a live filter,
// never a dead control. `labelKey` resolves via the i18n catalog at render.
const HERO_CHIPS: { labelKey: string; amenity: string }[] = [
  { labelKey: 'hero.chipHotTub', amenity: 'Hot Tub' },
  { labelKey: 'hero.chipFireplace', amenity: 'Fireplace' },
  { labelKey: 'hero.chipMountainView', amenity: 'Mountain View' },
  { labelKey: 'hero.chipSwimmingPool', amenity: 'Swimming Pool' },
];

/** Poster and video share one crop so the crossfade lines up. */
const HERO_POSITION = 'object-[30%_50%] md:object-center';

/** Seconds of crossfade to the poster at each end of the loop. */
const LOOP_FADE = 0.4;
/** Headline: per-word stagger and duration (ms). Search follows 200ms after. */
const WORD_STAGGER = 90;
const WORD_DURATION = 600;
const SEARCH_GAP = 200;

/**
 * 'pending' — first paint: poster only (it is the LCP image, preloaded on /).
 * 'video'   — the looping clip fades in over the poster once the page has
 *             loaded: 1920px WebM/MP4 on desktop, a 720px MP4 on phones.
 * 'still'   — prefers-reduced-motion, Save-Data or a 2G connection: the
 *             poster with a very slow 20s zoom; the video is never fetched.
 * (iPhone Low Power Mode refuses autoplay: play() rejects and the poster
 * simply stays, which is fine.)
 */
type HeroMode = 'pending' | 'video' | 'still';

/** Phones get the 768px poster and the 720px clip. Must match the <source media>. */
const MOBILE_MQ = '(max-width: 767px)';

function pickMode(): HeroMode {
  if (typeof window === 'undefined') return 'pending';
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const constrained = !!conn && (conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType ?? ''));
  if (constrained || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  return 'video';
}

/** Runs `fn` after the load event and an idle slot, so the video never competes with first paint / LCP. */
function afterLoadAndIdle(fn: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  const run = () => {
    if (cancelled) return;
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(() => !cancelled && fn(), { timeout: 2000 });
    else idleId = globalThis.setTimeout(() => !cancelled && fn(), 200) as unknown as number;
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', run);
    if (idleId !== undefined) {
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      else globalThis.clearTimeout(idleId);
    }
  };
}

/**
 * Landing hero: a 5-second "living photo" loop of a mountain cottage behind
 * the headline and live search.
 *
 * The poster (public/hero.webp / hero-768.webp, the still the clip was made
 * from, cropped to line up with its first frame) paints immediately; the
 * video is only mounted after load + idle, starts at opacity 0 and is faded
 * in/out over the first/last LOOP_FADE seconds of every pass so the loop jump
 * happens while only the poster is visible. All hero media is served from
 * public/ (Vercel), not Supabase Storage.
 */
export default function CinematicHero() {
  const navigate = useNavigate();
  const { t } = useT();
  const [sunset, setSunset] = useState(false);
  const [mode, setMode] = useState<HeroMode>('pending');
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Decide the mode after first paint; the video itself waits for load + idle.
  useEffect(() => {
    const m = pickMode();
    if (m !== 'video') { setMode(m); return; }
    return afterLoadAndIdle(() => setMode('video'));
  }, []);

  // Video: start muted, crossfade at the loop seam, pause while off-screen.
  useEffect(() => {
    const v = videoRef.current;
    const section = sectionRef.current;
    if (mode !== 'video' || !v || !section) return;
    v.muted = true; // React doesn't reliably reflect `muted`; autoplay needs it

    let raf = 0;
    const tick = () => {
      const d = v.duration;
      const time = v.currentTime;
      let o = 1;
      if (Number.isFinite(d) && d > LOOP_FADE * 2) {
        if (time < LOOP_FADE) o = time / LOOP_FADE;
        else if (time > d - LOOP_FADE) o = (d - time) / LOOP_FADE;
      }
      v.style.opacity = String(Math.max(0, Math.min(1, o)));
      raf = requestAnimationFrame(tick);
    };
    const onPlaying = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    const onPause = () => cancelAnimationFrame(raf);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) v.play().catch(() => { /* autoplay refused: poster stays */ });
      else v.pause();
    });
    io.observe(section);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
    };
  }, [mode]);

  const title = t('hero.insideTitle');
  const words = title.split(/\s+/).filter(Boolean);
  const searchDelay = (words.length - 1) * WORD_STAGGER + WORD_DURATION + SEARCH_GAP;

  // No overflow-hidden on the section: it clipped the Where dropdown. The
  // media layer has its own clipping wrapper for the zoom.
  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-[100svh]"
      aria-label="Find your cottage in Georgia"
    >
      {/* ── Media layer — poster + video, takes the golden-hour grade ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden bg-[#1d2a44] transition-[filter] duration-700"
        style={{ filter: sunset ? SUNSET_FILTER : undefined }}
      >
        {/* Cottage sits left of centre in the frame: on narrow portrait
            screens anchor the crop on it rather than on the empty valley. */}
        <picture>
          <source media={MOBILE_MQ} type="image/webp" srcSet="/hero-768.webp" />
          <source media={MOBILE_MQ} srcSet="/hero-768.jpg" />
          <source type="image/webp" srcSet="/hero.webp" />
          <img
            src="/hero.jpg"
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover ${HERO_POSITION} ${mode === 'still' ? 'rc-hero-zoom' : ''}`}
          />
        </picture>
        {mode === 'video' && (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={window.matchMedia(MOBILE_MQ).matches ? '/hero-768.webp' : '/hero.webp'}
            disablePictureInPicture
            className={`absolute inset-0 w-full h-full object-cover ${HERO_POSITION}`}
            style={{ opacity: 0 }}
          >
            {/* First match wins: phones take the 720px MP4 (328 KB). */}
            <source src="/hero-720.mp4" type="video/mp4" media={MOBILE_MQ} />
            <source src="/hero.webm" type="video/webm" />
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        )}
      </div>

      {/* ── Overlays: light shade under the nav, dark over the bottom 40%, sunset wash ── */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[28%] pointer-events-none"
        style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.38),rgba(0,0,0,0))' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none"
        style={{ background: 'linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.35) 55%,rgba(0,0,0,0))' }}
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

      {/* ── Stage: headline fades up word by word, then search slides up ── */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full flex flex-col items-center">
          {/* Full width, not shrink-to-fit: a centred box that hugs the text
              moves its left edge when the web font swaps in (CLS). */}
          <div className="w-full">
            <div
              className="rc-word text-xs font-extrabold uppercase text-white/80"
              style={{ letterSpacing: '.35em' }}
            >
              {t('hero.insideLabel')}
            </div>
            {/* Phones: reserve two lines. In the fallback font the Georgian
                headline fits one line, in Noto Sans Georgian it wraps to two —
                without the reserve the whole stage jumped ~20px when the font
                arrived (Lighthouse CLS 0.08). */}
            <h1
              key={title}
              className="mt-3 font-extrabold text-white leading-[1.15] text-[clamp(34px,5.5vw,60px)] max-md:min-h-[2.3em] max-md:flex max-md:flex-wrap max-md:content-center max-md:justify-center max-md:gap-x-[0.25em]"
              style={{ textShadow: '0 2px 18px rgba(0,0,0,.45)' }}
            >
              {words.map((w, i) => (
                <Fragment key={i}>
                  <span className="rc-word" style={{ animationDelay: `${i * WORD_STAGGER}ms` }}>{w}</span>
                  {i < words.length - 1 ? ' ' : null}
                </Fragment>
              ))}
            </h1>
          </div>

          {/* Live search card + amenity quick-filters */}
          <div className="rc-slide-up w-full max-w-[900px] mx-auto mt-8" style={{ animationDelay: `${searchDelay}ms` }}>
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
