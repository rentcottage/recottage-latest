import { useEffect, useRef, useState } from 'react';
import { useReveal } from '../../hooks/useReveal';

interface CountUpProps {
  /** Target value to count up to. */
  end: number;
  /** Animation duration in ms (default 1400). */
  duration?: number;
  /** Decimal places to show (default 0). */
  decimals?: number;
  /** Rendered before the number, e.g. "$". */
  prefix?: string;
  /** Rendered after the number, e.g. "+" or "k". */
  suffix?: string;
  /** Insert thousands separators (default true → 8,000). */
  separator?: boolean;
  className?: string;
}

/**
 * CountUp — animates a number from 0 to `end` once it scrolls into view.
 *
 * Reuses the IntersectionObserver in useReveal to trigger, and respects
 * `prefers-reduced-motion` (renders the final value immediately).
 */
export default function CountUp({
  end,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = true,
  className,
}: CountUpProps) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setValue(end);
      return;
    }

    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic for a snappy finish
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(end);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    // Safety net: if rAF gets throttled (background tab, etc.), guarantee the
    // number still lands on its final value shortly after the duration.
    const settle = setTimeout(() => setValue(end), duration + 150);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearTimeout(settle);
    };
  }, [visible, end, duration]);

  const rounded = Number(value.toFixed(decimals));
  const formatted = separator
    ? rounded.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : rounded.toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
