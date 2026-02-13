// App initialization — runs once on startup (client-side only)
// Debug fetch logging can be enabled by setting NEXT_PUBLIC_DEBUG_FETCH=true
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_FETCH === 'true') {
  const origFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    console.log('➡️ FETCH', req.method, req.url);
    const res = await origFetch(req);
    console.log('⬅️ RESPONSE', res.status, req.url);
    return res;
  };
}
