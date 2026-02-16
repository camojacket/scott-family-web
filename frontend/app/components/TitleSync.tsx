'use client';

import { useEffect } from 'react';
import { useFamilyName } from '../lib/FamilyNameContext';

/**
 * Syncs the document title with the resolved family name on the client side.
 * This ensures the browser tab always shows the correct family name, even if
 * the server-side metadata resolved the wrong host (e.g. behind a reverse proxy).
 */
export default function TitleSync() {
  const { family } = useFamilyName();

  useEffect(() => {
    document.title = `${family} — Strengthening Family Ties`;
  }, [family]);

  return null;
}
