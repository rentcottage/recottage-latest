import type { ElementType, ReactNode } from 'react';
import { useReveal } from '../../hooks/useReveal';

interface RevealProps {
  children: ReactNode;
  /** Delay in ms before the reveal transition starts — handy for staggering. */
  delay?: number;
  /** Render as a different element (default: div). */
  as?: ElementType;
  className?: string;
  /** Forwarded to the rendered element — preserves anchor-scroll targets. */
  id?: string;
  /** Fraction of the element visible before it triggers (0–1, default 0.1). */
  threshold?: number;
}

/**
 * Reveal — wraps content and fades + slides it up once it scrolls into view.
 *
 * The motion itself lives in the global `.reveal` / `.reveal-in` CSS classes
 * (see index.css), which also handle the `prefers-reduced-motion` guard.
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  id,
  threshold,
}: RevealProps) {
  const { ref, visible } = useReveal<HTMLElement>({ threshold });

  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal ${visible ? 'reveal-in' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
