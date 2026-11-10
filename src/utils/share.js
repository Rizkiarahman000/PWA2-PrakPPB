// ---------------------------------------------------------------------------
// share.js — share-link helpers for a single catalog entry.
//
// Each product gets its own deep link (a query param `?gun=<id>`). The share
// flow uses the Web Share API when the browser supports it; otherwise it
// falls back to copying the link into the clipboard. App.jsx reads the
// `gun` param on load to reopen that product's detail view.
// ---------------------------------------------------------------------------

export const SHARE_PARAM = 'gun'

/**
 * Build an absolute deep link that points back at this app with a ?gun= id.
 * @param {string|number} gunId
 */
export function buildShareUrl(gunId) {
  const url = new URL(window.location.href)
  url.search = `?${SHARE_PARAM}=${encodeURIComponent(gunId)}`
  url.hash = ''
  return url.toString()
}

/**
 * Share (or copy) a product deep link.
 * @param {Object} gun
 * @returns {Promise<{ ok: boolean, method: 'native'|'clipboard'|null }>}
 */
export async function shareGun(gun) {
  const id = gun?.id ?? gun?.name ?? gun?.recipe_id
  const url = buildShareUrl(id)
  const text = gun?.name
    ? `Check out the ${gun.name} in the hardware catalog`
    : url

  // 1) Native share sheet (mobile and some desktop browsers).
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: gun?.name || 'Catalog', text, url })
      return { ok: true, method: 'native' }
    } catch (err) {
      if (err && err.name === 'AbortError') return { ok: false, method: null }
      // User dismissed or share failed — fall through to clipboard.
    }
  }

  // 2) Clipboard fallback for browsers without native sharing.
  try {
    await navigator.clipboard.writeText(url)
    return { ok: true, method: 'clipboard' }
  } catch {
    return { ok: false, method: null }
  }
}

export default { buildShareUrl, shareGun, SHARE_PARAM }