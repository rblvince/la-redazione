import type { NextConfig } from "next";

function supabaseOrigins(rawUrl: string | undefined): string[] {
  try {
    const url = new URL(rawUrl ?? '');
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
    const socket = new URL(url.origin);
    socket.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return [url.origin, socket.origin];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : [],
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    const [supabaseOrigin, socketOrigin] = supabaseOrigins(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
      `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}${socketOrigin ? ` ${socketOrigin}` : ''}`,
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');
    return [
      { source: '/:path*', headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ...(process.env.NODE_ENV === 'production'
          ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
          : []),
      ] },
      { source: '/invito/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/auth/callback', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};

export default nextConfig;
