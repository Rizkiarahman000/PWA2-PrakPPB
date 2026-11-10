import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// useArchived — fetch soft-deleted (archived) products for the Profile page.
// ---------------------------------------------------------------------------

export function useArchived() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await gunService.getArchived()
      if (response.success) {
        setItems(response.data || [])
      } else {
        setError(response.message || 'Failed to load archives.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load archives.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { items, loading, error, refetch: fetch }
}

export default useArchived