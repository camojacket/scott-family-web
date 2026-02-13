'use client';

import React, { createContext, useContext, useMemo } from 'react';

/**
 * Domains that should display "Scott" instead of "Scott-Phillips".
 * Set via the NEXT_PUBLIC_SCOTT_ONLY_DOMAINS env var as a comma-separated list.
 * Example: NEXT_PUBLIC_SCOTT_ONLY_DOMAINS=scottfamily.com,www.scottfamily.com
 *
 * Any domain NOT in this list will default to "Scott-Phillips".
 */
const SCOTT_ONLY_DOMAINS: string[] = (
  process.env.NEXT_PUBLIC_SCOTT_ONLY_DOMAINS ?? ''
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export interface FamilyName {
  /** "Scott-Phillips" or "Scott" */
  full: string;
  /** "Scott-Phillips Family" or "Scott Family" */
  family: string;
  /** "Scott-Phillips Quarterly" or "Scott Quarterly" */
  quarterly: string;
  /** true when the short "Scott" variant is active */
  isScottOnly: boolean;
}

const FamilyNameContext = createContext<FamilyName>({
  full: 'Scott-Phillips',
  family: 'Scott-Phillips Family',
  quarterly: 'Scott-Phillips Quarterly',
  isScottOnly: false,
});

function resolveFamilyName(hostname: string): FamilyName {
  const isScottOnly = SCOTT_ONLY_DOMAINS.includes(hostname.toLowerCase());
  const full = isScottOnly ? 'Scott' : 'Scott-Phillips';
  return {
    full,
    family: `${full} Family`,
    quarterly: `${full} Quarterly`,
    isScottOnly,
  };
}

export function FamilyNameProvider({ children }: { children: React.ReactNode }) {
  const name = useMemo(() => {
    if (typeof window === 'undefined') {
      // SSR — default to Scott-Phillips; real value resolves on hydration
      return resolveFamilyName('');
    }
    return resolveFamilyName(window.location.hostname);
  }, []);

  return (
    <FamilyNameContext.Provider value={name}>
      {children}
    </FamilyNameContext.Provider>
  );
}

/**
 * Returns the family name strings appropriate for the current domain.
 *
 * Usage:
 * ```tsx
 * const { family, full, quarterly } = useFamilyName();
 * <h1>{family}</h1>  // "Scott-Phillips Family" or "Scott Family"
 * ```
 */
export function useFamilyName(): FamilyName {
  return useContext(FamilyNameContext);
}
