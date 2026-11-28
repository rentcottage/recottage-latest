import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { getPhotoUrl, type PhotoSize } from '../../lib/imageUrl';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  size: PhotoSize;
};

type Status = 'loading' | 'loaded' | 'failed';

/**
 * <img> for property photos. Shows the pre-generated WebP variant for `size`
 * and, if that variant isn't in the bucket, swaps to the original once.
 *
 * The image stays transparent until it has actually decoded, and removes
 * itself if the original fails too — so the browser's broken-image icon and
 * alt text are never painted. Callers put a placeholder BEHIND it (the
 * listing card's house-icon skeleton); the alt text survives as a visually
 * hidden span for screen readers.
 *
 * Why not just onError: after an error Chrome keeps painting the broken icon
 * + alt text until the NEXT src has finished downloading, which for a large
 * original is seconds of broken-image chrome.
 *
 * Defaults to lazy + async decoding; pass loading="eager" for the hero.
 */
export default function StoragePhoto({
  src, size, loading = 'lazy', decoding = 'async', onError, onLoad, style, alt = '', ...rest
}: Props) {
  const [state, setState] = useState<{ for: string; usingOriginal: boolean; status: Status }>(
    { for: src, usingOriginal: false, status: 'loading' },
  );
  // A changed photo starts again from its variant.
  const current = state.for === src ? state : { for: src, usingOriginal: false, status: 'loading' as Status };
  const shown = current.usingOriginal ? src : getPhotoUrl(src, size);
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0 && current.status === 'loading') {
      setState({ for: src, usingOriginal: current.usingOriginal, status: 'loaded' });
    }
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  if (current.status === 'failed') {
    return alt ? <span className="sr-only">{alt}</span> : null;
  }

  return (
    <img
      {...rest}
      ref={imgRef}
      // A new element per URL, so the failed one's broken state is never reused.
      key={shown}
      src={shown}
      alt={alt}
      loading={loading}
      decoding={decoding}
      style={current.status === 'loaded' ? style : { ...style, opacity: 0 }}
      onLoad={(e) => {
        setState({ for: src, usingOriginal: current.usingOriginal, status: 'loaded' });
        onLoad?.(e);
      }}
      onError={(e) => {
        if (shown !== src) setState({ for: src, usingOriginal: true, status: 'loading' });
        else setState({ for: src, usingOriginal: true, status: 'failed' });
        onError?.(e);
      }}
    />
  );
}
