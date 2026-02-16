'use client';

import NextImage, { type ImageProps } from 'next/image';
import { useCallback, useState } from 'react';

const PLACEHOLDER =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect fill="#e0e0e0" width="400" height="300"/>' +
      '<text x="200" y="150" text-anchor="middle" dominant-baseline="middle" ' +
      'fill="#999" font-family="sans-serif" font-size="16">Image unavailable</text></svg>',
  );

/** Maximum number of automatic retry attempts on load failure. */
const MAX_RETRIES = 2;

/**
 * Resilient wrapper around next/image.
 *
 * • `images.unoptimized` is set globally in next.config.ts so every image
 *   goes straight to the CDN – no dev-server proxy.
 * • On a transient CDN failure (ERR_CONNECTION_RESET, 503, etc.) the
 *   component auto-retries up to MAX_RETRIES times by cache-busting the URL.
 * • If all retries fail the user sees a neutral "Image unavailable" SVG
 *   instead of a broken-image icon.
 */
export default function CdnImage(props: ImageProps) {
  const { onError: externalOnError, src: originalSrc, ...rest } = props;

  const [retries, setRetries] = useState(0);
  const [failed, setFailed] = useState(false);

  // Append a cache-bust query parameter on each retry so the browser
  // makes a fresh request instead of serving the failed response from cache.
  const src = (() => {
    if (failed) return PLACEHOLDER;
    if (retries === 0 || typeof originalSrc !== 'string') return originalSrc;
    const sep = (originalSrc as string).includes('?') ? '&' : '?';
    return `${originalSrc}${sep}_r=${retries}`;
  })();

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (retries < MAX_RETRIES) {
        // Retry after a short delay to let transient CDN issues resolve.
        setTimeout(() => setRetries((r) => r + 1), 800 * (retries + 1));
      } else {
        setFailed(true);
      }
      externalOnError?.(e);
    },
    [retries, externalOnError],
  );

  return (
    <NextImage
      {...rest}
      src={src}
      onError={handleError}
      // Reset retry state if the parent provides a new src.
      key={typeof originalSrc === 'string' ? originalSrc : undefined}
    />
  );
}
