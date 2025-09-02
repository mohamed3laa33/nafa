// Simple in-memory cache with TTL. Replace with Redis later.
type Entry<T> = { v: T; exp: number };

const store = new Map<string, Entry<any>>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) {
    store.delete(key);
    return null;
  }
  return e.v as T;
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { v: value, exp: Date.now() + ttlMs });
}

export async function cacheWrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const v = await fn();
  await cacheSet(key, v, ttlMs);
  return v;
}

