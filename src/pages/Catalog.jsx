import { useState, useMemo } from 'react'
import {
  RefreshCw,
  Plus,
  Loader,
  AlertCircle,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

const PAGE_SIZE = 4

/**
 * Catalog page — the main product listing.
 *
 * Data source priority:
 *   1. Live API via useGuns() (server-side search / filter / sort / pagination)
 *   2. Local static array (GUNS_LOCAL) when the API is unreachable
 *
 * Features: search, category filter, sort, pagination, CRUD, detail modal.
 */
export default function Catalog({ onNavigate }) {
  // ---- filter / sort / pagination state ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)

  // Any change to a filter/sort resets back to the first page.
  const handleSearch = (v) => { setSearch(v); setPage(1) }
  const handleCategory = (v) => { setActiveCategory(v); setPage(1) }
  const handleSort = ({ key, order }) => { setSortKey(key); setSortOrder(order); setPage(1) }

  // ---- API data (server-side everything) ----
  const {
    guns: apiGuns,
    loading,
    error,
    pagination,
    refetch,
  } = useGuns({
    page,
    limit: PAGE_SIZE,
    search,
    category: activeCategory,
    sort_by: sortKey,
    order: sortOrder,
  })

  const [useLocal, setUseLocal] = useState(false)

  // Categories come from the known catalog taxonomy (GUNS_LOCAL mirrors the
  // seeded database) so the pills stay stable regardless of the current page.
  const categories = useMemo(() => extractCategories(GUNS_LOCAL), [])

  // ---- local fallback list (client-side filter + sort) ----
  const localFiltered = useMemo(() => {
    const enriched = GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    const filtered = enriched.filter(
      (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
    )
    return sortItems(filtered, sortKey, sortOrder)
  }, [search, activeCategory, sortKey, sortOrder])

  // ---- decide data source ----
  const usingServer = !useLocal && !(error && apiGuns.length === 0)

  const totalCount = usingServer
    ? (pagination?.total ?? apiGuns.length)
    : localFiltered.length

  const totalPages = usingServer
    ? (pagination?.totalPages ?? 1)
    : Math.max(1, Math.ceil(localFiltered.length / PAGE_SIZE))

  const visibleGuns = usingServer
    ? apiGuns
    : localFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const goToPage = (next) => {
    setPage(Math.min(Math.max(1, next), totalPages))
  }

  // ---- detail view ----
  const [selectedGun, setSelectedGun] = useState(null)

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      await gunService.deleteGun(deleteTarget.id)
      setDeleteTarget(null)
      setPage(1)
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- If viewing a single product detail ----
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => { setSelectedGun(null); setDeleteTarget(g) }}
        onArchive={() => { setSelectedGun(null); refetch() }}
      />
    )
  }

  // ---- Main catalog view ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">
              {totalCount} piece{totalCount !== 1 ? 's' : ''}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={handleSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {/* States */}
        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => { setUseLocal(true); setPage(1) }}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && visibleGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid */}
        {visibleGuns.length > 0 && (
          <ul className="stock">
            {visibleGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {visibleGuns.length > 0 && totalPages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="pagination__info">
              Page {page} of {totalPages} · {totalCount} total
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </nav>
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); setPage(1); refetch() }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
      />
      {deleteError && (
        <div className="toast toast--error">{deleteError}</div>
      )}
    </>
  )
}