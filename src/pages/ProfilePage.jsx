import { useState } from 'react'
import {
  Shield,
  Copy,
  Check,
  Heart,
  FileText,
  Archive,
  Pencil,
  Trash2,
  RotateCcw,
  Info,
  MapPin,
  Play,
  Camera,
} from 'lucide-react'
import userService from '../services/userService'
import gunService from '../services/gunService'
import { useFavorites } from '../hooks/useFavorites'
import { useArchived } from '../hooks/useArchived'
import {
  getAllDraftIds,
  loadDraft,
  deleteDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

/**
 * ProfilePage — Operator identity + settings.
 *
 * Sections:
 *   - Operator card (avatar, id, stats) + Edit Profile popup
 *   - System Briefing (About) & Range / Contact (moved from their own pages)
 *   - Saved Drafts (list of locally drafted catalog entries)
 *   - Archive (soft-deleted products: restore or delete permanently)
 */
export default function ProfilePage({ onReplaySplash, onNavigate }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')

  const { favorites } = useFavorites()

  // ---- Edit profile popup state ----
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(profile.username || 'Shooter')
  const [editBio, setEditBio] = useState(profile.bio || '')
  const [editAvatar, setEditAvatar] = useState(profile.avatar || null)

  // ---- Drafts ----
  const readDrafts = () =>
    getAllDraftIds().map((id) => {
      const data = loadDraft(id)
      return {
        id,
        name: data?.formData?.name?.trim() || (id === 'create' ? 'New hardware (untitled)' : `Hardware #${id}`),
        type: data?.formData?.type || '—',
        image: data?.uploadedImageUrl || data?.imagePreview || null,
        savedAt: getDraftTimestamp(id),
      }
    })

  const [drafts, setDrafts] = useState(readDrafts)

  // ---- Archive ----
  const { items: archived, loading: archiveLoading, refetch: refetchArchive } = useArchived()
  const [archiveAction, setArchiveAction] = useState(null) // { type: 'restore'|'delete', item }
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState('')

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const openEdit = () => {
    setEditName(profile.username || 'Shooter')
    setEditBio(profile.bio || '')
    setEditAvatar(profile.avatar || null)
    setShowEdit(true)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setFeedback('Avatar image must be under 2MB.')
      setTimeout(() => setFeedback(''), 3000)
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => setEditAvatar(event.target.result)
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    const updated = { ...profile, username: editName.trim() || 'Shooter', bio: editBio.trim(), avatar: editAvatar }
    const result = userService.saveUserProfile(updated)
    if (result.success) {
      setProfile(result.data)
      setShowEdit(false)
      setFeedback('Profile successfully updated.')
      setTimeout(() => setFeedback(''), 3000)
    } else {
      setFeedback('Failed to save profile.')
    }
  }

  const resumeDraft = (id) => {
    if (id === 'create') {
      if (onNavigate) onNavigate('Create')
    } else {
      const draft = drafts.find((d) => d.id === id)
      if (onNavigate) onNavigate('Edit', { id, name: draft?.name })
    }
  }

  const removeDraft = (id) => {
    deleteDraft(id)
    setDrafts(readDrafts())
  }

  const handleArchiveAction = async () => {
    if (!archiveAction) return
    try {
      setArchiveBusy(true)
      setArchiveMsg('')
      if (archiveAction.type === 'restore') {
        await gunService.restoreGun(archiveAction.item.id)
      } else {
        await gunService.deleteGun(archiveAction.item.id)
      }
      setArchiveAction(null)
      refetchArchive()
    } catch (err) {
      setArchiveMsg(err.message || 'Action failed.')
    } finally {
      setArchiveBusy(false)
    }
  }

  return (
    <div className="profile-page">
      <section className="masthead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, procurement statistics, saved drafts, and archived catalog.
          </p>
        </div>
        {onReplaySplash && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onReplaySplash}
            title="Replay introductory splash animation"
          >
            <Play size={14} /> Replay Intro
          </button>
        )}
      </section>

      {feedback && (
        <div className="toast toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
          </div>

          <div className="profile-identity">
            <h2 className="display">{profile.username || 'Shooter'}</h2>
            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyId}
                title="Copy User ID to clipboard"
              >
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <button type="button" className="btn btn--outline btn--sm profile-edit-btn" onClick={openEdit}>
            <Pencil size={14} /> Edit Profile
          </button>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{drafts.length}</div>
            <div className="stat-label">Saved Drafts</div>
          </div>
          <div className="stat-item">
            <Archive size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{archived.length}</div>
            <div className="stat-label">Archived</div>
          </div>
        </div>
      </div>

      {/* System Briefing (About) */}
      <section className="profile-section">
        <h3 className="section-title"><Info size={16} /> About this armory</h3>
        <h4 className="display" style={{ margin: '8px 0 0' }}>A one-room armory.</h4>
        <p className="lede" style={{ margin: '8px 0 0' }}>
          Bore &amp; Barrel sells a short, honest list of firearms. Each piece is priced
          from the bench — no markup theatre, no filler.
        </p>
      </section>

      {/* Range / Contact */}
      <section className="profile-section">
        <h3 className="section-title"><MapPin size={16} /> Range &amp; Contact</h3>
        <h4 className="display" style={{ margin: '8px 0 0' }}>Come by the shop.</h4>
        <p className="lede" style={{ margin: '8px 0 0' }}>
          123 Range Road. Open Tuesday to Saturday, 10 to 6. Call (555) 010-0100.
        </p>
      </section>

      {/* Drafts */}
      <section className="profile-section">
        <h3 className="section-title"><FileText size={16} /> Saved Drafts</h3>
        {drafts.length === 0 ? (
          <p className="detail-empty">No saved drafts yet.</p>
        ) : (
          <ul className="profile-list">
            {drafts.map((d) => (
              <li key={d.id} className="profile-list-item">
                {d.image && <img src={d.image} alt={d.name} className="profile-list-thumb" loading="lazy" />}
                <div className="profile-list-body">
                  <strong className="display">{d.name}</strong>
                  <span className="profile-list-meta">
                    {d.type}{d.savedAt ? ` · saved ${formatDraftTime(d.savedAt)}` : ''}
                  </span>
                </div>
                <div className="profile-list-actions">
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => resumeDraft(d.id)}>
                    Resume
                  </button>
                  <button type="button" className="btn btn--danger-ghost" onClick={() => removeDraft(d.id)} title="Delete draft">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Archive */}
      <section className="profile-section">
        <h3 className="section-title"><Archive size={16} /> Archive</h3>
        <p className="lede" style={{ margin: '8px 0 0' }}>
          Soft-deleted catalog entries. Restore them, or delete permanently.
        </p>
        {archiveMsg && <p className="form-error">{archiveMsg}</p>}
        {archiveLoading ? (
          <p className="detail-empty">Loading archives…</p>
        ) : archived.length === 0 ? (
          <p className="detail-empty">Archive is empty.</p>
        ) : (
          <ul className="profile-list">
            {archived.map((item) => (
              <li key={item.id} className="profile-list-item">
                <img src={item.image_url || item.image || '/guns/pistol.svg'} alt={item.name} className="profile-list-thumb" loading="lazy" />
                <div className="profile-list-body">
                  <strong className="display">{item.name}</strong>
                  <span className="profile-list-meta">
                    {item.type || '—'} · archived {item.archived_at ? formatDraftTime(item.archived_at) : ''}
                  </span>
                </div>
                <div className="profile-list-actions">
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => setArchiveAction({ type: 'restore', item })}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => setArchiveAction({ type: 'delete', item })}
                    title="Delete permanently"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Edit Profile popup */}
      {showEdit && (
        <div className="modal-backdrop" onClick={() => setShowEdit(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">Edit Profile</h3>
            <form onSubmit={handleSaveProfile} className="profile-form" style={{ padding: 0, border: 'none', gap: '14px' }}>
              <div className="avatar-wrap" style={{ margin: '0 auto' }}>
                {editAvatar ? (
                  <img src={editAvatar} alt="avatar preview" className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder"><Shield size={32} stroke="var(--brass)" /></div>
                )}
                <label htmlFor="edit-avatar-input" className="avatar-upload-btn" title="Upload avatar">
                  <Camera size={14} />
                  <input id="edit-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden-file-input" />
                </label>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="edit-prof-name" className="form-label">Callsign / Operator Alias</label>
                <input id="edit-prof-name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="form-input" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="edit-prof-bio" className="form-label">Armory Notes / Station Bio</label>
                <textarea id="edit-prof-bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="form-textarea" />
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn--cancel" onClick={() => setShowEdit(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-btn modal-btn--confirm">
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive action confirmation */}
      <ConfirmModal
        open={!!archiveAction}
        title={archiveAction?.type === 'restore' ? 'Restore this product?' : 'Delete permanently?'}
        message={
          archiveAction?.type === 'restore'
            ? `"${archiveAction?.item?.name}" will be moved back into the catalog.`
            : `"${archiveAction?.item?.name}" will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={archiveAction?.type === 'restore' ? 'Restore' : 'Delete'}
        danger={archiveAction?.type === 'delete'}
        loading={archiveBusy}
        onConfirm={handleArchiveAction}
        onCancel={() => setArchiveAction(null)}
      />
    </div>
  )
}