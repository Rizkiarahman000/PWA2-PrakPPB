import { apiClient, apiClientRaw, IS_SUPABASE } from '../config/api'
import { invalidateScope } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: item.image_url || item.image || '/guns/pistol.svg',
    image: item.image_url || item.image || '/guns/pistol.svg',
    images:
      Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : [item.image_url || item.image || '/guns/pistol.svg'],
    archived_at: item.archived_at || null,
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products.
   */
  async getGuns(params = {}) {
    if (IS_SUPABASE) {
      // Server-side pagination: limit / offset translated into a Range
      // request, combined with `Prefer: count=exact` so PostgREST returns the
      // total number of matching rows in the Content-Range header.
      const limit = Number(params.limit) || 10
      const page = Number(params.page) || 1
      const offset = (page - 1) * limit

      const queryParts = ['select=*']

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      // Soft delete: the catalog only lists active products. Archived items
      // are requested separately (params.archived === true).
      if (params.archived) {
        queryParts.push('archived_at=not.is.null')
      } else {
        queryParts.push('archived_at=is.null')
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc,id.desc')
      }

      const queryString = queryParts.join('&')

      const response = await apiClientRaw.get(`/rest/v1/products?${queryString}`, {
        headers: {
          Prefer: 'count=exact',
          Range: `${offset}-${offset + limit - 1}`,
        },
      })

      const payload = response.data
      const list = (Array.isArray(payload) ? payload : []).map(normalizeProduct)

      let total = list.length
      const contentRange = response.headers && response.headers['content-range']
      if (contentRange) {
        const totalPart = contentRange.split('/')[1]
        if (totalPart && totalPart !== '*') {
          total = parseInt(totalPart, 10) || total
        }
      }

      return {
        success: true,
        data: list,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  /**
   * Fetch a single product by ID.
   */
  async getGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: data.image_url || (Array.isArray(data.images) ? data.images[0] : null) || null,
        images: Array.isArray(data.images)
          ? data.images
          : data.image_url
          ? [data.image_url]
          : [],
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      invalidateScope('guns')
      return { success: true, data: normalizeProduct(created) }
    }
    return apiClient.post('/api/v1/recipes', data)
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (data.image_url !== undefined) payload.image_url = data.image_url
      if (data.images !== undefined) {
        const imgs = Array.isArray(data.images) ? data.images : []
        payload.images = imgs
        if (imgs.length > 0) payload.image_url = imgs[0]
      }

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      invalidateScope('guns')
      return { success: true, data: normalizeProduct(updated) }
    }
    return apiClient.put(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Delete product.
   */
  async deleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      invalidateScope('guns')
      invalidateScope('archived')
      return { success: true }
    }
    return apiClient.delete(`/api/v1/recipes/${id}`)
  }

  /**
   * Soft delete — mark a product as archived (hidden from the catalog).
   */
  async archiveGun(id) {
    if (IS_SUPABASE) {
      await apiClient.patch(`/rest/v1/products?id=eq.${id}`, {
        archived_at: new Date().toISOString(),
      })
      invalidateScope('guns')
      invalidateScope('archived')
      return { success: true }
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, { archived: true })
  }

  /**
   * Restore an archived product back into the catalog.
   */
  async restoreGun(id) {
    if (IS_SUPABASE) {
      await apiClient.patch(`/rest/v1/products?id=eq.${id}`, {
        archived_at: null,
      })
      invalidateScope('guns')
      invalidateScope('archived')
      return { success: true }
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, { archived: false })
  }

  /**
   * Fetch all archived (soft-deleted) products.
   */
  async getArchived() {
    return this.getGuns({ archived: true, limit: 100, sort_by: 'archived_at', order: 'desc' })
  }
}

export default new GunService()
