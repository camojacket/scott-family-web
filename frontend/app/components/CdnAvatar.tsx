'use client';

import { Avatar, type AvatarProps } from '@mui/material';
import { useCallback, useState } from 'react';

/** Maximum number of automatic retry attempts on load failure. */
const MAX_RETRIES = 2;

/**
 * Resilient wrapper around MUI Avatar.
 *
 * On a transient CDN failure (ERR_CONNECTION_RESET, 503, etc.) the component
 * auto-retries up to MAX_RETRIES times by cache-busting the URL.
 * If all retries fail the Avatar falls back to its children (initials / icon).
 */
export default function CdnAvatar(props: AvatarProps) {
  const { src: originalSrc, imgProps, children, ...rest } = props;

  const [retries, setRetries] = useState(0);
  const [failed, setFailed] = useState(false);

  // Cache-bust on each retry so the browser makes a fresh request.
  const src = (() => {
    if (failed || !originalSrc) return undefined;
    if (retries === 0) return originalSrc;
    const sep = originalSrc.includes('?') ? '&' : '?';
    return `${originalSrc}${sep}_r=${retries}`;
  })();

  const handleImgError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (retries < MAX_RETRIES) {
        setTimeout(() => setRetries((r) => r + 1), 800 * (retries + 1));
      } else {
        setFailed(true);
      }
      imgProps?.onError?.(e);
    },
    [retries, imgProps],
  );

  return (
    <Avatar
      {...rest}
      src={src}
      imgProps={{ ...imgProps, onError: handleImgError }}
      // Reset retry state when the parent provides a new src.
      key={originalSrc ?? 'no-src'}
    >
      {children}
    </Avatar>
  );
}
