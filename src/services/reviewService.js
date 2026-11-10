import { apiClient, IS_SUPABASE } from '../config/api'
import { invalidateScope } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings.
// Supports both Supabase (public.reviews) and university API (/api/v1/recipes/:id/reviews).
// ---------------------------------------------------------------------------

class ReviewService {
  /**
   * Fetch all reviews for a given product.
   */
  async getReviews(gunId, userId = null) {
    if (IS_SUPABASE) {
      const [data, reactions] = await Promise.all([
        apiClient.get(
          `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
        ),
        userId
          ? apiClient.get(
              `/rest/v1/review_reactions?user_id=eq.${userId}&select=review_id,reaction`,
            )
          : Promise.resolve([]),
      ])

      const myReactionMap = new Map()
      ;(Array.isArray(reactions) ? reactions : []).forEach((r) => {
        myReactionMap.set(r.review_id, r.reaction)
      })

      const list = Array.isArray(data)
        ? data.map((r) => ({
            id: r.id,
            product_id: r.product_id,
            user_id: r.user_id,
            user_identifier: r.user_id
              ? `Operator ${String(r.user_id).substring(0, 8)}`
              : 'Anonymous',
            rating: r.rating,
            comment: r.comment || '',
            created_at: r.created_at,
            likes: Number(r.likes) || 0,
            dislikes: Number(r.dislikes) || 0,
            my_reaction: myReactionMap.get(r.id) || null,
          }))
        : []

      return { success: true, data: list }
    }

    return apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
  }

  /**
   * Submit a new review.
   * @param {string|number} gunId
   * @param {Object} reviewData  { user_identifier, rating, comment }
   */
  async createReview(gunId, reviewData) {
    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || reviewData.user_identifier,
        rating: Number(reviewData.rating),
        comment: reviewData.comment || '',
      }

      const res = await apiClient.post('/rest/v1/reviews', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      invalidateScope('reviews')
      return { success: true, data: created }
    }

    return apiClient.post(`/api/v1/recipes/${gunId}/reviews`, reviewData)
  }

  /**
   * Edit an existing review.
   */
  async updateReview(reviewId, reviewData) {
    if (IS_SUPABASE) {
      const res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        {
          rating: Number(reviewData.rating),
          comment: reviewData.comment,
        },
        { headers: { Prefer: 'return=representation' } },
      )
      invalidateScope('reviews')
      return { success: true, data: Array.isArray(res) ? res[0] : res }
    }

    return apiClient.put(`/api/v1/reviews/${reviewId}`, reviewData)
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      invalidateScope('reviews')
      return { success: true }
    }

    return apiClient.delete(`/api/v1/reviews/${reviewId}`)
  }

  /**
   * Toggle a like / dislike on a review. The current user cannot react to
   * their own review (enforced in the UI); anyone else toggles between
   * 'like', 'dislike', and none. Counts are recomputed from the reactions
   * table to avoid drift.
   */
  async toggleReaction(reviewId, userId, reaction) {
    if (!IS_SUPABASE) {
      return { success: true, data: null }
    }

    const existingRows = await apiClient.get(
      `/rest/v1/review_reactions?review_id=eq.${reviewId}&user_id=eq.${userId}&select=*`,
    )
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null

    if (existing && existing.reaction === reaction) {
      // Same reaction → remove it (toggle off).
      await apiClient.delete(
        `/rest/v1/review_reactions?review_id=eq.${reviewId}&user_id=eq.${userId}`,
      )
      await this._recountReactions(reviewId)
      invalidateScope('reviews')
      return { success: true, data: { my_reaction: null } }
    }

    if (existing) {
      // Different reaction → switch it.
      await apiClient.delete(
        `/rest/v1/review_reactions?review_id=eq.${reviewId}&user_id=eq.${userId}`,
      )
    }

    await apiClient.post(
      '/rest/v1/review_reactions',
      { review_id: Number(reviewId), user_id: userId, reaction },
      { headers: { Prefer: 'return=minimal' } },
    )
    await this._recountReactions(reviewId)
    invalidateScope('reviews')
    return { success: true, data: { my_reaction: reaction } }
  }

  /**
   * Recompute a review's like/dislike counts from the reactions table.
   */
  async _recountReactions(reviewId) {
    const rows = await apiClient.get(
      `/rest/v1/review_reactions?review_id=eq.${reviewId}&select=reaction`,
    )
    const list = Array.isArray(rows) ? rows : []
    const likes = list.filter((r) => r.reaction === 'like').length
    const dislikes = list.length - likes
    await apiClient.patch(`/rest/v1/reviews?id=eq.${reviewId}`, { likes, dislikes })
  }
}

export default new ReviewService()
