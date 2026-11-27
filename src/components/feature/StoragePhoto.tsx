import { useState, type ImgHTMLAttributes } from 'react';
import { getPhotoUrl, type PhotoSize } from '../../lib/imageUrl';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  size: PhotoSize;
};

/**
 * <img> for property photos. Shows the pre-generated WebP variant for `size`
 * and, if that variant isn't in the bucket yet (photo uploaded before the
 * variants existed and not yet processed by scripts/optimize-images.mjs),
 * swaps to the original object once. Never retries the original.
 *
 * Defaults to lazy + async decoding; pass loading="eager" for the hero.
 */
export default function StoragePhoto({ src, size, loading = 'lazy', decoding = 'async', onError, ...rest }: Props) {
  // Keyed on src so a changed photo starts again from its variant.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const variant = getPhotoUrl(src, size);
  const shown = failedFor === src ? src : variant;

  return (
    <img
      {...rest}
      src={shown}
      loading={loading}
      decoding={decoding}
      onError={(e) => {
        if (shown !== src) setFailedFor(src);
        onError?.(e);
      }}
    />
  );
}
