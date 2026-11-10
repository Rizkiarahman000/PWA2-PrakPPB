// ---------------------------------------------------------------------------
// queryCache.js — tiny in-memory query cache with time-to-live (TTL).
//
// Caches GET responses so a repeated request (same page / filters / id)
// resolves instantly without hitting the network again. Every mutation
// (create / update / delete) calls `invalidateScope` so cached data never
// outlives a write.
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 30 * 1000 // 30 seconds

const store = new Map()

/**
 * Read a cache entry. Returns `undefined` when missing or expired.
 */
export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

/**
 * Write a cache entry with an optional TTL (defaults to 30s).
 */
export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/**
 * Invalidate every entry whose key starts with `scope`.
 * Omit the scope to clear the entire cache.
 */
export function invalidateScope(scope = '') {
  if (!scope) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(scope)) store.delete(key)
  }
}

/**
 * Build a deterministic cache key from a scope name and params object.
 */
export function buildKey(scope, params = {}) {
  return `${scope}:${JSON.stringify(params)}`
}

export default { cacheGet, cacheSet, invalidateScope, buildKey }