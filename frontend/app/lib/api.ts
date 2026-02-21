import type { AssetUploadResponse, AssetKind } from './types';

export const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, '')) ||
  '';

type JsonInit = Omit<RequestInit, 'body'> & { body?: unknown };

/** Custom error class with HTTP status info for callers to handle gracefully */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} ${statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`);
    this.name = 'ApiError';
  }

  /** True for 401/403 — caller may want to redirect to login */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Read the XSRF-TOKEN cookie set by Spring Security's CookieCsrfTokenRepository.
 * Returns the token value or null if not present (e.g., SSR or first request).
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: JsonInit = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach CSRF token for state-changing requests (POST/PUT/PATCH/DELETE)
  const method = (init.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-XSRF-TOKEN', csrfToken);
    }
  }

  const url = `${API_BASE}${normalizePath(path)}`;

  const resp = await fetch(url, {
    credentials: 'include',
    ...init,
    headers,
    body:
      init.body === undefined || init.body instanceof FormData
        ? (init.body as BodyInit | undefined)
        : JSON.stringify(init.body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');

    // Global auth interceptor: if session expired/invalid, clear local auth and redirect
    if (resp.status === 401 || resp.status === 403) {
      const isAuthEndpoint = path.includes('/auth/');
      if (!isAuthEndpoint && typeof window !== 'undefined') {
        // For 403, verify the session is actually dead before redirecting
        // (a real 403 means "authenticated but no permission" — don't log out)
        if (resp.status === 403) {
          try {
            const probe = await fetch(`${API_BASE}/api/auth/session-info`, {
              credentials: 'include',
            });
            if (probe.ok) {
              // Session is valid — this is a genuine "forbidden" error, not a dead session
              throw new ApiError(resp.status, resp.statusText, text);
            }
          } catch (e) {
            if (e instanceof ApiError) throw e;
            // probe failed — session is dead, fall through to redirect
          }
        }

        localStorage.removeItem('profile');
        window.dispatchEvent(new Event('profile-updated'));
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?reason=expired&next=${returnTo}`;
        // Return a never-resolving promise so callers don't continue
        return new Promise<T>(() => {});
      }
    }

    throw new ApiError(resp.status, resp.statusText, text);
  }

  const ct = resp.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) return (await resp.text()) as T;
  return (await resp.json()) as T;
}

export async function uploadAnonymous(kind: AssetKind, file: File): Promise<AssetUploadResponse> {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<AssetUploadResponse>(`/api/assets/anonymous/${kind}`, {
    method: 'POST',
    body: fd,
  });
}

export async function uploadForUser(userId: number, kind: AssetKind, file: File): Promise<AssetUploadResponse> {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch<AssetUploadResponse>(`/api/users/${userId}/assets/${kind}`, {
    method: 'POST',
    body: fd,
  });
}
