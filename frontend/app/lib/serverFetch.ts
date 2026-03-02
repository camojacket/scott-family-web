/**
 * Server-side fetch helper for Next.js Server Components and Route Handlers.
 *
 * Forwards the user's session cookie (JSESSIONID) to the backend API
 * so server-rendered pages can fetch authenticated data.
 *
 * Usage (in a Server Component):
 *   import { serverFetch } from '@/app/lib/serverFetch';
 *   const products = await serverFetch<ProductDto[]>('/api/store/products');
 */

import { cookies, headers } from 'next/headers';

/** Default timeout for backend calls (milliseconds). */
const DEFAULT_TIMEOUT_MS = 15_000;

const API_ORIGIN =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.replace(/\/+$/, '')) ||
  // Fallback: same-origin requests to the backend via the internal Docker/Azure network
  process.env.BACKEND_ORIGIN ||
  'http://localhost:8080';

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Resolve the backend base URL.
 *
 * In production behind Azure Front Door both apps share a domain, but
 * server components can't use relative URLs — they need an absolute origin.
 * We derive it from the incoming request headers when possible.
 */
async function resolveOrigin(): Promise<string> {
  // If the env var points to a full URL, use it directly
  if (API_ORIGIN.startsWith('http')) return API_ORIGIN;

  // Otherwise try to reconstruct from request headers
  const hdrs = await headers();
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:8080';
  return `${proto}://${host}`;
}

export async function serverFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const origin = await resolveOrigin();
  const url = `${origin}${normalizePath(path)}`;
  console.error(`[serverFetch] ${path} → ${url}`);

  // Forward the user's cookies so the backend sees the session
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  // Enforce a timeout so a slow backend can never hang the SSR indefinitely.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        ...Object.fromEntries(new Headers(init.headers || {}).entries()),
        Cookie: cookieHeader,
      },
      // Don't cache authenticated data by default
      cache: init.cache ?? 'no-store',
    });

    if (!resp.ok) {
      throw new Error(`serverFetch ${path}: HTTP ${resp.status} ${resp.statusText}`);
    }

    const ct = resp.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')) return (await resp.text()) as T;
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolve the family name label from the incoming request headers.
 * Mirrors the logic in layout.tsx and FamilyNameContext.tsx.
 */
const SCOTT_ONLY_DOMAINS: string[] = (
  process.env.NEXT_PUBLIC_SCOTT_ONLY_DOMAINS ?? ''
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export async function getFamilyLabel(): Promise<{
  full: string;
  family: string;
  quarterly: string;
  isScottOnly: boolean;
}> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '';
  const hostname = host.split(':')[0].toLowerCase();
  const isScottOnly = SCOTT_ONLY_DOMAINS.includes(hostname);
  const full = isScottOnly ? 'Scott' : 'Scott-Phillips';
  return {
    full,
    family: `${full} Family`,
    quarterly: `${full} Quarterly`,
    isScottOnly,
  };
}
