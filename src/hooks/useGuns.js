import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'
import { cacheGet, cacheSet, buildKey } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list from the API.
//
// Every response is cached (in-memory, TTL 30s) keyed by the params object.
// When a fresh cache entry exists for the same params the hook serves it
// without a network round-trip; `refetch` forces a revalidation.
//
// Returns { guns, loading, error, pagination, refetch }.
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Serialise params so the effect re-runs only when they actually change.
  const cacheKey = buildKey('guns', params)

  const fetchGuns = useCallback(async ({ force = false } = {}) => {
    // 1) Serve from cache when a fresh, matching entry exists.
    const cached = force ? undefined : cacheGet(cacheKey)
    if (cached) {
      setGuns(cached.data || [])
      setPagination(cached.pagination || null)
      setError(null)
      setLoading(false)
      return cached
    }

    setLoading(true)
    setError(null)

    try {
      const response = await gunService.getGuns(params)

      if (response.success) {
        const data = response.data || []
        const paging = response.pagination || null
        setGuns(data)
        setPagination(paging)
        cacheSet(cacheKey, { data, pagination: paging })
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  // Force-refresh (bypasses the cache) — used after mutations.
  const refetch = useCallback(() => fetchGuns({ force: true }), [fetchGuns])

  return { guns, loading, error, pagination, refetch }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its id.
//
// Returns { gun, loading, error, refetch }.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGunById(id)

      if (response.success) {
        setGun(response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun }
}