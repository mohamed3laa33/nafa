import { NextResponse } from 'next/server';

// Basic in-memory rate limit per IP+path
const hits = new Map<string, { count: number; reset: number }>();

export function middleware(req: Request) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/')) return NextResponse.next();

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'anon';
  const key = `${ip}:${url.pathname}`;

  const now = Date.now();
  const windowMs = 10_000; // 10s
  const limit = 60; // 60 requests / 10s per IP per path
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return NextResponse.next();
  } else {
    entry.count += 1;
    if (entry.count > limit) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', Math.ceil((entry.reset - now) / 1000).toString());
      return res;
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/:path*'],
};

