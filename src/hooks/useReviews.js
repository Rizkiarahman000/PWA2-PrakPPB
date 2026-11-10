import { useState, useEffect, useCallback } from 'react'
import reviewService from '../services/reviewService'
import { cacheGet, cacheSet, buildKey } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useReviews — fetch reviews for a specific product, with query caching.
// ---------------------------------------------------------------------------

export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cacheKey = buildKey('reviews', { gunId })

  const fetchReviews = useCallback(async ({ force = false } = {}) => {
    if (!gunId) {
      setLoading(false)
      return
    }

    const cached = force ? undefined : cacheGet(cacheKey)
    if (cached) {
      setReviews(cached || [])
      setError(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await reviewService.getReviews(gunId)

      if (response.success) {
        const data = response.data || []
        setReviews(data)
        cacheSet(cacheKey, data)
      } else {
        setError(response.message || 'Failed to fetch reviews.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching reviews.')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [gunId, cacheKey])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const refetch = useCallback(() => fetchReviews({ force: true }), [fetchReviews])

  return { reviews, loading, error, refetch }
}

// ---------------------------------------------------------------------------
// useCreateReview — submit a new review for a product.
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)

      const response = await reviewService.createReview(gunId, reviewData)

      if (response.success) {
        setSuccess(true)
        return response.data
      } else {
        setError(response.message || 'Failed to submit review.')
        return null
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createReview, loading, error, success }
}