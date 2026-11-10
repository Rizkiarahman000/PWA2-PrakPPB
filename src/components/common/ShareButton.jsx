import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { shareGun } from '../../utils/share'

/**
 * Share / copy a product's deep link.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {string}   [props.className]— extra classes (e.g. 'card-act-btn', 'btn btn--outline')
 * @param {boolean}  [props.label]   — render a text label next to the icon
 */
export default function ShareButton({ gun, className = '', label = false }) {
  const [state, setState] = useState('idle') // 'idle' | 'busy' | 'done'

  const handleShare = async (e) => {
    e.stopPropagation()
    if (state !== 'idle') return
    setState('busy')
    const result = await shareGun(gun)
    setState(result.ok ? 'done' : 'idle')
    if (result.ok) {
      setTimeout(() => setState('idle'), 1800)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      disabled={state === 'busy'}
      aria-label="Share this product"
      title={state === 'done' ? 'Link copied!' : 'Share this product'}
    >
      {state === 'done' ? <Check size={16} /> : <Share2 size={16} />}
      {label && <span>{state === 'done' ? 'Copied!' : 'Share'}</span>}
    </button>
  )
}