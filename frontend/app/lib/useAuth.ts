import { useEffect, useState, useCallback } from 'react';

export interface AuthInfo {
  id: number | null;
  personId: number | null;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  displayName: string | null;
  profilePictureUrl: string | null;
}

const EMPTY: AuthInfo = {
  id: null,
  personId: null,
  username: null,
  role: null,
  isAdmin: false,
  displayName: null,
  profilePictureUrl: null,
};

/**
 * Shared hook that reads the authenticated user's profile from localStorage
 * and derives isAdmin. Listens for the 'profile-updated' event so all
 * components stay in sync (e.g. after login/logout).
 *
 * Replaces the duplicated 5-line localStorage + JSON.parse + role check
 * pattern that was copy-pasted across 20+ page components.
 *
 * Usage:
 *   const { isAdmin, id, displayName } = useAuth();
 */
export function useAuth(): AuthInfo {
  const read = useCallback((): AuthInfo => {
    if (typeof window === 'undefined') return EMPTY;
    try {
      const raw = localStorage.getItem('profile');
      if (!raw) return EMPTY;
      const p = JSON.parse(raw);
      const role: string = p.userRole || p.role || '';
      return {
        id: p.id ?? null,
        personId: p.personId ?? null,
        username: p.username ?? null,
        role,
        isAdmin: role === 'ROLE_ADMIN' || role === 'ADMIN',
        displayName: p.displayName ?? null,
        profilePictureUrl: p.profilePictureUrl ?? null,
      };
    } catch {
      return EMPTY;
    }
  }, []);

  const [auth, setAuth] = useState<AuthInfo>(EMPTY);

  useEffect(() => {
    // Initial read
    setAuth(read());

    // Listen for profile changes (login, logout, profile update)
    const handler = () => setAuth(read());
    window.addEventListener('profile-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('profile-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [read]);

  return auth;
}
