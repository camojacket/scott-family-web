'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from './api';

export interface AuthInfo {
  id: number | null;
  personId: number | null;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  displayName: string | null;
  profilePictureUrl: string | null;
  /** True while the server-side admin check is still in flight */
  adminLoading: boolean;
}

const EMPTY: AuthInfo = {
  id: null,
  personId: null,
  username: null,
  role: null,
  isAdmin: false,
  displayName: null,
  profilePictureUrl: null,
  adminLoading: true,
};

const AuthContext = createContext<AuthInfo>(EMPTY);

function readLocalProfile(): Omit<AuthInfo, 'adminLoading'> {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem('profile');
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    return {
      id: p.id ?? null,
      personId: p.personId ?? null,
      username: p.username ?? null,
      role: p.userRole || p.role || '',
      isAdmin: false,
      displayName: p.displayName ?? null,
      profilePictureUrl: p.profilePictureUrl ?? null,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Provider that makes a single GET /api/auth/me call and shares
 * server-validated auth state with the entire component tree.
 * Admin status is NEVER trusted from localStorage alone.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthInfo>(EMPTY);
  const verifyInFlight = useRef(false);

  const verifyAdmin = useCallback(async () => {
    const raw = localStorage.getItem('profile');
    if (!raw) {
      setAuth(prev => ({ ...prev, isAdmin: false, adminLoading: false }));
      return;
    }
    if (verifyInFlight.current) return;
    verifyInFlight.current = true;
    try {
      const server = await apiFetch<{
        id?: number;
        personId?: number;
        username?: string;
        userRole?: string;
        displayName?: string;
        profilePictureUrl?: string;
      }>('/api/auth/me');
      const serverRole = server.userRole || '';
      const serverIsAdmin = serverRole === 'ROLE_ADMIN' || serverRole === 'ADMIN';

      // Sync localStorage so cached data can't drift
      try {
        const cached = JSON.parse(raw);
        if (cached.userRole !== serverRole) {
          cached.userRole = serverRole;
          localStorage.setItem('profile', JSON.stringify(cached));
        }
      } catch { /* ignore */ }

      setAuth(prev => ({ ...prev, isAdmin: serverIsAdmin, role: serverRole, adminLoading: false }));
    } catch {
      setAuth(prev => ({ ...prev, isAdmin: false, adminLoading: false }));
    } finally {
      verifyInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    setAuth({ ...readLocalProfile(), adminLoading: true });
    verifyAdmin();

    const handler = () => {
      setAuth({ ...readLocalProfile(), adminLoading: true });
      verifyAdmin();
    };
    window.addEventListener('profile-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('profile-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [verifyAdmin]);

  return React.createElement(AuthContext.Provider, { value: auth }, children);
}

/**
 * Hook to access server-validated auth state.
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthInfo {
  return useContext(AuthContext);
}
