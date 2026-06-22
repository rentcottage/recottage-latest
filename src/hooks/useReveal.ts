import { useEffect, useRef, useState } from 'react';

/**
 * useReveal — fires once when the observed element scrolls into view.
 *
 * Returns a ref to attach to the target element and a boolean that flips to
 * true the first time the element crosses the viewport threshold. Observation
 * stops after the first reveal so it never re-animates on scroll-back.
 *
 * Respects `prefers-reduced-motion`: if the user opts out of animation, the
 * element is considered visible immediately.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string },
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    // Reveal immediately if the element is already in view or has been
    // scrolled past on mount (above-the-fold content, deep links, fast
    // flicks that the observer might skip). Never let content stay hidden.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    if (rect.bottom <= 0) {
      // Already scrolled past — show without animating in.
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: options?.threshold ?? 0.1,
        rootMargin: options?.rootMargin ?? '0px 0px -5% 0px',
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin]);

  return { ref, visible };
}
