import { useState, useMemo } from 'react'

const CATEGORIES = [
  'All Categories',
  'Electronics & Devices',
  'Books & Stationery',
  'Bottles & Drinkware',
  'Bags & Backpacks',
  'Keys & Wallets',
  'Cards & IDs',
  'Clothing & Accessories',
  'Other Items',
]

export default function CampusFeed({
  lostReports = [],
  foundReports = [],
  loading = false,
  error = null,
  onRefresh,
  onClaimItem,
  onOpenLostModal,
  onOpenFoundModal,
  user,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'lost' | 'found'
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'open' | 'resolved'

  // Combine and normalize lost and found reports for flexible filtering
  const allReports = useMemo(() => {
    const lost = (lostReports || []).map((item) => ({
      ...item,
      reportType: 'LOST',
      date: item.lost_date,
      location: item.lost_location,
      isOpen: (item.status || 'OPEN').toUpperCase() === 'OPEN',
    }))

    const found = (foundReports || []).map((item) => ({
      ...item,
      reportType: 'FOUND',
      date: item.found_date,
      location: item.found_location,
      isOpen: (item.status || 'OPEN').toUpperCase() === 'OPEN',
    }))

    return [...lost, ...found].sort((a, b) => {
      const dateA = new Date(a.created_at || a.date || 0)
      const dateB = new Date(b.created_at || b.date || 0)
      return dateB - dateA
    })
  }, [lostReports, foundReports])

  // Filtered reports
  const filteredReports = useMemo(() => {
    return allReports.filter((item) => {
      // 1. Type filter
      if (typeFilter === 'lost' && item.reportType !== 'LOST') return false
      if (typeFilter === 'found' && item.reportType !== 'FOUND') return false

      // 2. Category filter
      if (categoryFilter !== 'All Categories' && item.category !== categoryFilter) {
        return false
      }

      // 3. Status filter
      if (statusFilter === 'open' && !item.isOpen) return false
      if (statusFilter === 'resolved' && item.isOpen) return false

      // 4. Search keyword filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchName = (item.item_name || '').toLowerCase().includes(query)
        const matchDesc = (item.description || '').toLowerCase().includes(query)
        const matchLoc = (item.location || '').toLowerCase().includes(query)
        const matchCat = (item.category || '').toLowerCase().includes(query)

        if (!matchName && !matchDesc && !matchLoc && !matchCat) {
          return false
        }
      }

      return true
    })
  }, [allReports, typeFilter, categoryFilter, statusFilter, searchTerm])

  const counts = useMemo(() => {
    return {
      all: allReports.length,
      lost: allReports.filter((r) => r.reportType === 'LOST').length,
      found: allReports.filter((r) => r.reportType === 'FOUND').length,
    }
  }, [allReports])

  return (
    <section id="campus-feed" className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Campus Activity Feed
              </h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                Live
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Recent lost reports and discovered items across campus
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="grid gap-3 md:grid-cols-12 md:items-center">
            
            {/* Search Input */}
            <div className="relative md:col-span-5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                🔍
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by item name, location, or keyword..."
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Type Filter Buttons */}
            <div className="flex rounded-xl bg-slate-100 p-1 md:col-span-4">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  typeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('lost')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  typeFilter === 'lost'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lost ({counts.lost})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('found')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  typeFilter === 'found'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Found ({counts.found})
              </button>
            </div>

            {/* Category Dropdown */}
            <div className="md:col-span-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Secondary Sub-filters: Status */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  statusFilter === 'open'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Active / Open
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  statusFilter === 'resolved'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Resolved / Closed
              </button>
            </div>

            <span className="text-slate-400">
              Showing {filteredReports.length} results
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
            ⚠️ Notice: {error}
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-16 rounded-md bg-slate-200" />
                  <div className="h-5 w-24 rounded-md bg-slate-100" />
                </div>
                <div className="mt-4 h-6 w-3/4 rounded-md bg-slate-200" />
                <div className="mt-2 h-4 w-full rounded-md bg-slate-100" />
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <div className="h-4 w-1/2 rounded-md bg-slate-100" />
                  <div className="h-4 w-2/3 rounded-md bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredReports.length === 0 && (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
              📭
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">
              No matching campus reports found
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              Try adjusting your search query or filters. If you lost or found something, you can submit a new report now.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onOpenLostModal}
                className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800"
              >
                Report Lost Item
              </button>
              <button
                type="button"
                onClick={onOpenFoundModal}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Report Found Item
              </button>
            </div>
          </div>
        )}

        {/* Reports Grid */}
        {!loading && filteredReports.length > 0 && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredReports.map((item) => {
              const isLost = item.reportType === 'LOST'
              const isOpen = item.isOpen

              return (
                <div
                  key={`${item.reportType}-${item.id}`}
                  className={`group flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                    isLost ? 'border-amber-200/80 hover:border-amber-300' : 'border-blue-200/80 hover:border-blue-300'
                  }`}
                >
                  <div>
                    {/* Badges Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            isLost
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isLost ? 'Lost Item' : 'Found Item'}
                        </span>

                        {item.is_unregistered_custodian ? (
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                            Handed to Campus Staff
                          </span>
                        ) : (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              isOpen
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isOpen ? 'Open' : 'Resolved'}
                          </span>
                        )}
                      </div>

                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {item.category}
                      </span>
                    </div>

                    {/* Item Title & Description */}
                    <h3 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-blue-700">
                      {item.item_name}
                    </h3>

                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {item.description || 'No additional public description provided.'}
                    </p>

                    {/* Location & Date details */}
                    <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span>📍</span>
                        <span className="font-semibold text-slate-700">
                          {isLost ? 'Lost near: ' : 'Found at: '}
                        </span>
                        <span className="truncate">{item.location}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span>🗓️</span>
                        <span className="font-semibold text-slate-700">Date: </span>
                        <span>{item.date}</span>
                      </div>

                      {/* Found Item Custody Status Notice */}
                      {!isLost && (
                        <div className="flex items-start gap-1.5 text-[11px]">
                          <span className="mt-0.5">🛡️</span>
                          <div>
                            <span className="font-semibold text-slate-700">Custody: </span>
                            {item.is_unregistered_custodian ? (
                              <span className="text-purple-900 font-medium">
                                Handed to {item.unregistered_custodian_name || 'Campus Staff'}
                                {item.unregistered_custodian_role ? ` (${item.unregistered_custodian_role})` : ''}
                                {item.unregistered_custodian_location ? ` • ${item.unregistered_custodian_location}` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-600">With student/faculty finder</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    {!isLost ? (
                      isOpen ? (
                        item.is_unregistered_custodian ? (
                          user?.id && item.finder_id && String(user.id) === String(item.finder_id) ? (
                            <div className="w-full text-center rounded-xl bg-purple-50 border border-purple-200 py-2.5 px-3 text-xs font-semibold text-purple-800">
                              Discovered by you • Deposited with campus staff
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onClaimItem(item)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-purple-800 transition"
                            >
                              <span>🏛️</span>
                              <span>Collect from Campus Office</span>
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => onClaimItem(item)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-800 transition"
                          >
                            <span>🛡️</span>
                            <span>Claim This Item</span>
                          </button>
                        )
                      ) : (
                        <div className="w-full text-center rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-500">
                          Item Reunited with Owner ✓
                        </div>
                      )
                    ) : (
                      <div className="text-xs text-slate-400 italic text-center">
                        {isOpen ? 'Did you find this? Contact or report a matching item.' : 'Resolved by owner ✓'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </section>
  )
}
