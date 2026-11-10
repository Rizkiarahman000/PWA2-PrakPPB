import { useEffect, useState } from 'react'
import { ArrowLeft, Star, Send, Loader, Archive } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import ReviewItem from './ReviewItem'
import ConfirmModal from '../modals/ConfirmModal'
import { useReviews, useCreateReview } from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import reviewService from '../../services/reviewService'
import gunService from '../../services/gunService'
import { formatPrice, averageRating } from '../../utils/helpers'

/**
 * Full-screen product detail view with image gallery, archive (soft delete),
 * and reviews (create / edit / delete own, like / dislike others).
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onBack    — return to catalog
 * @param {Function} [props.onEdit]  — navigate to edit page
 * @param {Function} [props.onDelete]— trigger permanent delete flow
 * @param {Function} [props.onArchive]— called after a successful archive
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete, onArchive }) {
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const images = Array.isArray(gun.images) && gun.images.length > 0 ? gun.images : [imgSrc]
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  const [activeImg, setActiveImg] = useState(images[0])
  useEffect(() => {
    setActiveImg(images[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gun.id])

  const currentUserId = getUserIdentifier()

  // Reviews
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [reviewToDelete, setReviewToDelete] = useState(null)
  const [deletingReview, setDeletingReview] = useState(false)

  // Archive
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    const result = await createReview(gun.id, {
      user_identifier: currentUserId,
      rating,
      comment: comment.trim(),
    })

    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      refetchReviews()
    } else {
      setReviewError('Could not submit review. The server may be unavailable.')
    }
  }

  const handleEditReview = async (reviewId, nextRating, nextComment) => {
    try {
      await reviewService.updateReview(reviewId, {
        rating: nextRating,
        comment: nextComment,
      })
      refetchReviews()
    } catch (err) {
      setReviewError(err.message || 'Could not update review.')
    }
  }

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return
    try {
      setDeletingReview(true)
      await reviewService.deleteReview(reviewToDelete.id)
      setReviewToDelete(null)
      refetchReviews()
    } catch (err) {
      setReviewError(err.message || 'Could not delete review.')
    } finally {
      setDeletingReview(false)
    }
  }

  const handleReact = async (review, reaction) => {
    try {
      await reviewService.toggleReaction(review.id, currentUserId, reaction)
      refetchReviews()
    } catch (err) {
      setReviewError(err.message || 'Could not update reaction.')
    }
  }

  const handleArchiveConfirm = async () => {
    try {
      setArchiving(true)
      setArchiveError('')
      await gunService.archiveGun(gun.id)
      setShowArchiveConfirm(false)
      if (onArchive) onArchive(gun)
      else if (onBack) onBack()
    } catch (err) {
      setArchiveError(err.message || 'Failed to archive.')
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero with image gallery */}
      <div className="detail-hero">
        <div className="detail-media">
          <img className="detail-img" src={activeImg} alt={gun.name} />
          {images.length > 1 && (
            <div className="detail-thumbs">
              {images.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  className={`detail-thumb${activeImg === url ? ' detail-thumb--active' : ''}`}
                  onClick={() => setActiveImg(url)}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={url} alt={`${gun.name} thumbnail ${i + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <FavoriteButton gunId={gun.id || gun.name} />
            <ShareButton gun={gun} className="btn btn--outline" label />
            {onEdit && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                Edit
              </button>
            )}
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setShowArchiveConfirm(true)}
            >
              <Archive size={16} /> Archive
            </button>
            {onDelete && (
              <button type="button" className="btn btn--danger" onClick={() => onDelete(gun)}>
                Delete
              </button>
            )}
          </div>
          {archiveError && <p className="form-error">{archiveError}</p>}
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>{step.instruction || step}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews</h2>

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a short review (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !gun.id}
          >
            {submitting ? (
              <><Loader size={16} className="spin" /> Submitting…</>
            ) : (
              <><Send size={16} /> Submit Review</>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {/* Existing reviews */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => (
              <ReviewItem
                key={rev.id}
                review={rev}
                isOwn={String(rev.user_id) === String(currentUserId)}
                onEdit={handleEditReview}
                onDelete={setReviewToDelete}
                onReact={handleReact}
              />
            ))}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>

      {/* Archive confirmation */}
      <ConfirmModal
        open={showArchiveConfirm}
        title="Archive this product?"
        message={`"${gun.name}" will be moved to the archive. You can restore it later from your Profile.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchiveConfirm}
        onCancel={() => { setShowArchiveConfirm(false); setArchiveError('') }}
      />

      {/* Delete review confirmation */}
      <ConfirmModal
        open={!!reviewToDelete}
        title="Delete review?"
        message="This review will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={deletingReview}
        onConfirm={handleDeleteReview}
        onCancel={() => setReviewToDelete(null)}
      />
    </div>
  )
}