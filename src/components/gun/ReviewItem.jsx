import { useState } from 'react'
import { Star, ThumbsUp, ThumbsDown, Pencil, Trash2, Check, X } from 'lucide-react'

/**
 * A single review row.
 *
 * The owner sees Edit / Delete actions; everyone else sees Like / Dislike.
 *
 * @param {Object}   props
 * @param {Object}   props.review  — review row ({ id, user_id, rating, comment, likes, dislikes, my_reaction, ... })
 * @param {boolean}  props.isOwn   — whether the current user wrote this review
 * @param {Function} props.onEdit  — (reviewId, rating, comment) => void
 * @param {Function} props.onDelete— (review) => void
 * @param {Function} props.onReact — (review, 'like'|'dislike') => void
 */
export default function ReviewItem({ review, isOwn, onEdit, onDelete, onReact }) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(review.rating)
  const [comment, setComment] = useState(review.comment || '')

  const userLabel = review.user_identifier || 'Anonymous'

  const submitEdit = () => {
    onEdit(review.id, rating, comment.trim())
    setEditing(false)
  }

  const cancelEdit = () => {
    setEditing(false)
    setRating(review.rating)
    setComment(review.comment || '')
  }

  return (
    <li className="review-item">
      <div className="review-head">
        <span className="review-user">
          {userLabel}
          {isOwn && <span className="review-own-tag">(you)</span>}
        </span>
        {!editing && (
          <span className="review-stars-display">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={14}
                fill={i < review.rating ? 'var(--brass)' : 'none'}
                stroke={i < review.rating ? 'var(--brass)' : 'var(--line)'}
              />
            ))}
          </span>
        )}
      </div>

      {editing ? (
        <div className="review-edit">
          <div className="review-edit-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={18}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>
          <textarea
            className="review-input"
            rows={2}
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="review-edit-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={submitEdit}>
              <Check size={14} /> Save
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={cancelEdit}>
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        review.comment && <p className="review-comment">{review.comment}</p>
      )}

      {!editing && (
        <div className="review-actions">
          {isOwn ? (
            <>
              <button
                type="button"
                className="review-action-btn"
                onClick={() => setEditing(true)}
                title="Edit review"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="review-action-btn review-action-btn--danger"
                onClick={() => onDelete(review)}
                title="Delete review"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`review-action-btn${review.my_reaction === 'like' ? ' review-action-btn--active' : ''}`}
                onClick={() => onReact(review, 'like')}
                title="Like this review"
              >
                <ThumbsUp size={14} /> {review.likes > 0 ? review.likes : ''}
              </button>
              <button
                type="button"
                className={`review-action-btn${review.my_reaction === 'dislike' ? ' review-action-btn--active' : ''}`}
                onClick={() => onReact(review, 'dislike')}
                title="Dislike this review"
              >
                <ThumbsDown size={14} /> {review.dislikes > 0 ? review.dislikes : ''}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}