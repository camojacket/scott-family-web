'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE } from './api';

/** How early (in seconds) before expiry to show the warning dialog. */
const WARNING_LEAD_SECONDS = 120; // 2 minutes before timeout

/** Minimum interval (ms) between activity pings to the server. */
const PING_THROTTLE_MS = 60_000; // at most once per minute

/** Events that count as "user activity". */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export interface SessionTimeoutState {
  /** True when the warning dialog should be shown */
  showWarning: boolean;
  /** Seconds remaining until auto-logout when warning is visible */
  secondsLeft: number;
  /** Call this to dismiss the warning and reset the timer (extend session) */
  extendSession: () => void;
  /** Call this to log out immediately */
  logoutNow: () => void;
}

/**
 * Hook that manages session timeout synced with Spring Security.
 *
 * 1. On mount, fetches the server-configured timeout from GET /api/auth/session-info
 * 2. Tracks user activity and pings the server to reset idle timer
 * 3. Shows a warning dialog 2 minutes before expiry
 * 4. Auto-logs out when the timer reaches zero
 */
export function useSessionTimeout(): SessionTimeoutState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number | null>(null);

  // Refs for timers
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  /** Wall-clock time when the warning should fire (survives JS timer throttling) */
  const warningDeadlineRef = useRef<number>(Infinity);
  /** Wall-clock time when auto-logout should fire */
  const logoutDeadlineRef = useRef<number>(Infinity);

  // Check if user is logged in
  const isLoggedIn = useCallback(() => {
    try {
      return !!localStorage.getItem('profile');
    } catch {
      return false;
    }
  }, []);

  // Perform logout — clear local state, redirect to login
  const performLogout = useCallback(() => {
    localStorage.removeItem('profile');
    window.dispatchEvent(new Event('profile-updated'));

    // Call server logout (best-effort)
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});

    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?reason=timeout&next=${returnTo}`;
  }, []);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Start the warning countdown (called when warning should show)
  const startCountdown = useCallback((seconds: number) => {
    setSecondsLeft(seconds);
    setShowWarning(true);

    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Time's up — log out
          clearTimers();
          performLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers, performLogout]);

  // Schedule the warning timer based on timeout config
  const scheduleWarning = useCallback((totalSeconds: number) => {
    clearTimers();
    setShowWarning(false);

    const now = Date.now();
    const warningAt = Math.max(totalSeconds - WARNING_LEAD_SECONDS, 0);
    const leadTime = Math.min(WARNING_LEAD_SECONDS, totalSeconds);

    // Record wall-clock deadlines so visibility handler can correct after mobile sleep
    warningDeadlineRef.current = now + warningAt * 1000;
    logoutDeadlineRef.current = now + totalSeconds * 1000;

    warningTimerRef.current = setTimeout(() => {
      if (!isLoggedIn()) return;
      startCountdown(leadTime);
    }, warningAt * 1000);
  }, [clearTimers, isLoggedIn, startCountdown]);

  // Ping server to reset session idle timer (throttled)
  const pingServer = useCallback(async () => {
    const now = Date.now();
    if (now - lastPingRef.current < PING_THROTTLE_MS) return;
    lastPingRef.current = now;

    try {
      const resp = await fetch(`${API_BASE}/api/auth/session-ping`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!resp.ok) {
        // Session already expired server-side
        if (resp.status === 401 || resp.status === 403) {
          // Double-check: only logout if we still think we're logged in
          // AND enough time has passed since login (avoid race with cross-origin cookie setup)
          if (isLoggedIn() && Date.now() - lastActivityRef.current > 30_000) {
            performLogout();
          }
        }
        return;
      }
      const data = await resp.json();
      if (!data.alive) {
        performLogout();
        return;
      }
      // Reset the local warning timer
      if (timeoutSeconds) {
        scheduleWarning(timeoutSeconds);
      }
    } catch {
      // Network error — don't logout, backend might just be temporarily unreachable
    }
  }, [timeoutSeconds, scheduleWarning, performLogout, isLoggedIn]);

  // Handle user activity
  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (!isLoggedIn()) return;

    // If warning is showing, don't auto-dismiss — user must click "Stay Logged In"
    if (!showWarning && timeoutSeconds) {
      // Reset local timer and ping server
      scheduleWarning(timeoutSeconds);
      pingServer();
    }
  }, [isLoggedIn, showWarning, timeoutSeconds, scheduleWarning, pingServer]);

  // Extend session (user clicked "Stay Logged In")
  const extendSession = useCallback(() => {
    setShowWarning(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    lastPingRef.current = 0; // Force next ping
    pingServer();
    if (timeoutSeconds) {
      scheduleWarning(timeoutSeconds);
    }
  }, [timeoutSeconds, scheduleWarning, pingServer]);

  // Logout immediately from dialog
  const logoutNow = useCallback(() => {
    clearTimers();
    performLogout();
  }, [clearTimers, performLogout]);

  // Fetch session config on mount
  useEffect(() => {
    if (!isLoggedIn()) return;

    let cancelled = false;

    async function fetchSessionInfo() {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/session-info`, {
          credentials: 'include',
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && data.timeoutSeconds) {
          setTimeoutSeconds(data.timeoutSeconds);
        }
      } catch {
        // Fallback: assume 20 minutes
        if (!cancelled) setTimeoutSeconds(1200);
      }
    }

    fetchSessionInfo();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // When timeoutSeconds is known, start the warning schedule
  useEffect(() => {
    if (!timeoutSeconds || !isLoggedIn()) return;
    scheduleWarning(timeoutSeconds);
    return () => clearTimers();
  }, [timeoutSeconds, isLoggedIn, scheduleWarning, clearTimers]);

  // Register activity listeners
  useEffect(() => {
    if (!isLoggedIn()) return;

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [isLoggedIn, onActivity]);

  // Handle page visibility changes (mobile app-switch / tab switch).
  // JS timers are paused while the page is hidden, so rely on wall-clock deadlines instead.
  useEffect(() => {
    if (!isLoggedIn() || !timeoutSeconds) return;

    const onVisibility = async () => {
      if (document.hidden) return; // only act when the page becomes visible again

      const now = Date.now();

      // If the logout deadline has passed while we were away, verify with the server
      // before kicking the user out (the server may have received activity from another tab).
      if (now >= logoutDeadlineRef.current) {
        try {
          lastPingRef.current = now;
          const resp = await fetch(`${API_BASE}/api/auth/session-ping`, {
            method: 'POST',
            credentials: 'include',
          });
          if (!resp.ok || !(await resp.json()).alive) {
            performLogout();
            return;
          }
        } catch {
          // Network error — don't logout
        }
        // Server session is still alive — reset everything
        scheduleWarning(timeoutSeconds);
        return;
      }

      // If the warning deadline has passed, show warning with corrected remaining time
      if (now >= warningDeadlineRef.current) {
        const remaining = Math.max(0, Math.round((logoutDeadlineRef.current - now) / 1000));
        if (remaining <= 0) {
          // Edge case: exactly at the boundary — ping to verify
          pingServer();
          return;
        }
        clearTimers();
        startCountdown(remaining);
        return;
      }

      // Otherwise we came back well within the timeout — just ping to keep alive
      // and reschedule timers with corrected wall-clock time
      pingServer();
      const remaining = Math.max(0, Math.round((logoutDeadlineRef.current - now) / 1000));
      clearTimers();
      scheduleWarning(remaining);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isLoggedIn, timeoutSeconds, scheduleWarning, clearTimers, startCountdown, performLogout, pingServer]);

  // Listen for profile-updated events (login/logout in other tabs)
  useEffect(() => {
    const onProfileUpdate = () => {
      if (!isLoggedIn()) {
        clearTimers();
        setShowWarning(false);
      }
    };
    window.addEventListener('profile-updated', onProfileUpdate);
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === 'profile' && !e.newValue) {
        clearTimers();
        setShowWarning(false);
      }
    });
    return () => {
      window.removeEventListener('profile-updated', onProfileUpdate);
    };
  }, [isLoggedIn, clearTimers]);

  return { showWarning, secondsLeft, extendSession, logoutNow };
}
