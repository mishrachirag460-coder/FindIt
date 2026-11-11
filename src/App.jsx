
import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useAuth } from './context/AuthContext'
import AuthModal from './components/AuthModal'

function App() {
  const { user, profile, signOut } = useAuth()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalTab, setAuthModalTab] = useState('signin')

  const [showLostForm, setShowLostForm] = useState(false)
  const [showFoundForm, setShowFoundForm] = useState(false)

  const [submitted, setSubmitted] = useState(false)
  const [lostError, setLostError] = useState(null)
  const [foundSubmitted, setFoundSubmitted] = useState(false)
  const [foundError, setFoundError] = useState(null)

  // Live feed state
  const [lostReports, setLostReports] = useState([])
  const [foundReports, setFoundReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [feedError, setFeedError] = useState(null)
  const [reportsTab, setReportsTab] = useState('all') // 'all' | 'lost' | 'found'

  // Fetch safe public report feeds (strictly omitting any private notes/markers/clues)
  const fetchReports = async () => {
    setLoadingReports(true)
    setFeedError(null)

    let lostData = []
    let foundData = []
    const errMessages = []

    // 1. Fetch Lost Reports separately
    try {
      const { data, error } = await supabase
        .from('lost_reports')
        .select('id, item_name, category, description, lost_location, lost_date, created_at')
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) {
        console.warn('lost_reports table query notice:', error)
        // Fallback to public catalog view if base table is restricted by RLS
        const fallback = await supabase
          .from('lost_items_public_catalog')
          .select('id, item_name, category, description, lost_location, lost_date, created_at')
          .order('created_at', { ascending: false })
          .limit(25)

        if (fallback.error) {
          errMessages.push(`Lost reports: ${error.message} (${error.code || 'RLS'})`)
        } else {
          lostData = fallback.data || []
        }
      } else {
        lostData = data || []
      }
    } catch (e) {
      errMessages.push(`Lost reports: ${e.message}`)
    }

    // 2. Fetch Found Reports separately
    try {
      const { data, error } = await supabase
        .from('found_reports')
        .select('id, item_name, category, description, found_location, found_date, current_custody, created_at')
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) {
        console.warn('found_reports table query notice:', error)
        // Fallback to public catalog view if base table is restricted by RLS
        const fallback = await supabase
          .from('found_items_public_catalog')
          .select('id, item_name, category, description, found_location, found_date, created_at')
          .order('created_at', { ascending: false })
          .limit(25)

        if (fallback.error) {
          errMessages.push(`Found reports: ${error.message} (${error.code || 'RLS'})`)
        } else {
          foundData = fallback.data || []
        }
      } else {
        foundData = data || []
      }
    } catch (e) {
      errMessages.push(`Found reports: ${e.message}`)
    }

    setLostReports(lostData)
    setFoundReports(foundData)

    if (errMessages.length > 0 && lostData.length === 0 && foundData.length === 0) {
      setFeedError(errMessages.join(' | '))
    }
    setLoadingReports(false)
  }

  useEffect(() => {
    fetchReports()
  }, [user])

  // Save Lost Report directly to Supabase table
  const handleLostSubmit = async (event) => {
    event.preventDefault()
    setLostError(null)

    if (!user) {
      openSignIn()
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)

    const lostReport = {
      item_name: formData.get('item_name')?.trim(),
      category: formData.get('category'),
      description: formData.get('description')?.trim() || '',
      lost_location: formData.get('lost_location')?.trim(),
      lost_date: formData.get('lost_date'),
    }

    const { error } = await supabase
      .from('lost_reports')
      .insert([lostReport])

    if (error) {
      console.error('Database Error:', error.message)
      setLostError(error.message)
      return
    }

    setSubmitted(true)
    form.reset()
    fetchReports()
  }

  // Save Found Report directly to Supabase table
  const handleFoundSubmit = async (event) => {
    event.preventDefault()
    setFoundError(null)

    if (!user) {
      openSignIn()
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)

    const foundReport = {
      item_name: formData.get('item_name')?.trim(),
      category: formData.get('category'),
      description: formData.get('description')?.trim() || '',
      found_location: formData.get('found_location')?.trim(),
      found_date: formData.get('found_date'),
      current_custody: formData.get('current_custody') || 'IN_MY_POSSESSION',
    }

    const { error } = await supabase
      .from('found_reports')
      .insert([foundReport])

    if (error) {
      console.error('Database Error:', error.message)
      setFoundError(error.message)
      return
    }

    setFoundSubmitted(true)
    form.reset()
    fetchReports()
  }

  const openLostForm = () => {
    setShowLostForm(true)
    setShowFoundForm(false)
    setSubmitted(false)
    setLostError(null)
  }

  const openFoundForm = () => {
    setShowFoundForm(true)
    setShowLostForm(false)
    setFoundSubmitted(false)
    setFoundError(null)
  }

  const openSignIn = () => {
    setAuthModalTab('signin')
    setIsAuthModalOpen(true)
  }

  const openSignUp = () => {
    setAuthModalTab('register')
    setIsAuthModalOpen(true)
  }

  // Combined and filtered public reports (safely omitting any sensitive/private data)
  const combinedReports = [
    ...lostReports.map((r) => ({ ...r, _type: 'lost' })),
    ...foundReports.map((r) => ({ ...r, _type: 'found' })),
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

  const displayedReports =
    reportsTab === 'all'
      ? combinedReports
      : reportsTab === 'lost'
      ? lostReports.map((r) => ({ ...r, _type: 'lost' }))
      : foundReports.map((r) => ({ ...r, _type: 'found' }))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Navbar */}
      <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 md:px-16">
        <h1 className="text-2xl font-bold text-blue-700">
          FindIt<span className="text-slate-900">.</span>
        </h1>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#" className="hover:text-blue-700">Home</a>
          <a href="#feed" className="hover:text-blue-700">Recent Items</a>
          <a href="#report" className="hover:text-blue-700">Report an Item</a>
          <a href="#how-it-works" className="hover:text-blue-700">How It Works</a>
        </div>

        {/* Auth Navigation */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Desktop User Info & FindIt ID */}
              <div className="hidden flex-col items-end sm:flex">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {profile?.full_name || user.email?.split('@')[0] || 'Member'}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {profile?.member_type || 'STUDENT'}
                  </span>
                </div>
                {profile?.findit_id ? (
                  <span className="font-mono text-xs font-bold text-blue-700">
                    {profile.findit_id}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Loading ID...</span>
                )}
              </div>

              {/* Mobile User Info */}
              <div className="flex flex-col items-end sm:hidden">
                <span className="font-mono text-xs font-bold text-blue-700">
                  {profile?.findit_id || 'Member'}
                </span>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-red-600"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={openSignIn}
                className="px-2 py-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={openSignUp}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-800 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                Student Sign Up
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 md:px-16 md:py-28">
        <div className="mx-auto max-w-5xl text-center">

          <span className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            Campus Item Recovery System
          </span>

          <h2 className="mt-7 text-4xl font-bold leading-tight md:text-6xl">
            Lost Something on Campus?
            <span className="block text-blue-700">
              Let's Find It Together.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
            FindIt connects students, teachers and campus staff
            to make lost and found item recovery easier,
            safer and more organised.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">

            <button
              onClick={openLostForm}
              className="rounded-xl bg-blue-700 px-7 py-4 font-semibold text-white hover:bg-blue-800"
            >
              Report Lost Item →
            </button>

            <button
              onClick={openFoundForm}
              className="rounded-xl border border-slate-300 bg-white px-7 py-4 font-semibold text-slate-800 hover:bg-slate-100"
            >
              Report Found Item
            </button>

          </div>

          <p className="mt-5 text-sm text-slate-500">
            One campus. One connected recovery system.
          </p>

        </div>
      </section>

      {/* Lost Item Form */}
      {showLostForm && (
        <section className="px-6 py-12 md:px-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Report a Lost Item</h2>

              <button
                type="button"
                onClick={() => setShowLostForm(false)}
                className="text-2xl text-slate-500 hover:text-red-600"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Provide details to help identify your missing item.
            </p>

            <form onSubmit={handleLostSubmit} className="mt-8 space-y-5">

              <div>
                <label className="mb-2 block font-medium">Item Name</label>
                <input
                  type="text"
                  name="item_name"
                  placeholder="e.g. Black water bottle"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Category</label>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select category</option>
                  <option>Electronics</option>
                  <option>Books & Stationery</option>
                  <option>Water Bottles</option>
                  <option>Bags</option>
                  <option>Accessories</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">Description</label>
                <textarea
                  name="description"
                  placeholder="Describe your item..."
                  rows="3"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Lost Location</label>
                <input
                  type="text"
                  name="lost_location"
                  placeholder="e.g. College Library"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Lost Date</label>
                <input
                  type="date"
                  name="lost_date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Submit Lost Report
              </button>

              {submitted && (
                <p className="rounded-lg bg-green-100 p-4 text-green-700">
                  Lost report successfully saved to FindIt!
                </p>
              )}

              {lostError && (
                <p className="rounded-lg bg-red-100 p-4 text-red-700">
                  Report save nahi hui: {lostError}
                </p>
              )}

            </form>
          </div>
        </section>
      )}

      {/* Found Item Form */}
      {showFoundForm && (
        <section className="px-6 py-12 md:px-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Report a Found Item</h2>

              <button
                type="button"
                onClick={() => setShowFoundForm(false)}
                className="text-2xl text-slate-500 hover:text-red-600"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Provide details about the item you found on campus.
            </p>

            <form onSubmit={handleFoundSubmit} className="mt-8 space-y-5">

              <div>
                <label className="mb-2 block font-medium">Item Name</label>
                <input
                  type="text"
                  name="item_name"
                  placeholder="e.g. Blue college bag"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Category</label>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select category</option>
                  <option>Electronics</option>
                  <option>Books & Stationery</option>
                  <option>Water Bottles</option>
                  <option>Bags</option>
                  <option>Accessories</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">Description</label>
                <textarea
                  name="description"
                  placeholder="Describe the found item..."
                  rows="3"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Found Location</label>
                <input
                  type="text"
                  name="found_location"
                  placeholder="e.g. College Library"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Found Date</label>
                <input
                  type="date"
                  name="found_date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Current Custody</label>
                <select
                  name="current_custody"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select current custody</option>
                  <option>I have the item</option>
                  <option>Handed over to a teacher</option>
                  <option>Handed over to HOD office</option>
                  <option>Handed over to college office</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Submit Found Report
              </button>

              {foundSubmitted && (
                <p className="rounded-lg bg-green-100 p-4 text-green-700">
                  Found report successfully saved to FindIt!
                </p>
              )}

              {foundError && (
                <p className="rounded-lg bg-red-100 p-4 text-red-700">
                  {foundError}
                </p>
              )}

            </form>
          </div>
        </section>
      )}

      {/* Report Cards */}
      <section id="report" className="px-6 pb-20 md:px-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-3xl">🔍</div>
            <h3 className="mt-5 text-xl font-bold">I Lost Something</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Submit a lost item report and help others identify
              your missing belongings.
            </p>
            <button
              onClick={openLostForm}
              className="mt-6 font-semibold text-blue-700"
            >
              Report Lost Item →
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-3xl">📦</div>
            <h3 className="mt-5 text-xl font-bold">I Found Something</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Report a found item and help its rightful owner
              recover it through a coordinated process.
            </p>
            <button
              onClick={openFoundForm}
              className="mt-6 font-semibold text-blue-700"
            >
              Report Found Item →
            </button>
          </div>

        </div>
      </section>

      {/* Live Campus Feed: Recent Lost & Found Reports */}
      <section id="feed" className="border-t border-slate-200 bg-slate-100/70 px-6 py-20 md:px-16">
        <div className="mx-auto max-w-5xl">
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Live Campus Feed</span>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Recent Lost & Found Items</h2>
              <p className="mt-2 text-sm text-slate-600">Browse recently reported items or check for your missing belongings.</p>
            </div>

            {/* Filter Pills & Refresh */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setReportsTab('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    reportsTab === 'all'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({lostReports.length + foundReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportsTab('lost')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    reportsTab === 'lost'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lost ({lostReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportsTab('found')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    reportsTab === 'found'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Found ({foundReports.length})
                </button>
              </div>

              <button
                type="button"
                onClick={fetchReports}
                title="Refresh feed"
                className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700 shadow-sm transition"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Database Notice / Error Banner */}
          {feedError && (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div>
                  <p className="font-semibold">Feed Notice / RLS Database State:</p>
                  <p className="mt-0.5 text-xs text-amber-800">{feedError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loadingReports ? (
            <div className="mt-10 py-16 text-center text-slate-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-4 text-sm font-medium">Loading campus reports...</p>
            </div>
          ) : displayedReports.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <span className="text-4xl">📋</span>
              <h3 className="mt-3 text-lg font-bold text-slate-800">No reports found</h3>
              <p className="mt-1 text-sm text-slate-500">Be the first to report a lost or found item on campus!</p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={openLostForm}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Report Lost
                </button>
                <button
                  type="button"
                  onClick={openFoundForm}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Report Found
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayedReports.map((item) => (
                <div
                  key={`${item._type}-${item.id}`}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    {/* Header: Type Badge & Category */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          item._type === 'lost'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item._type === 'lost' ? 'LOST' : 'FOUND'}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.category}
                      </span>
                    </div>

                    {/* Item Name */}
                    <h3 className="mt-3 text-lg font-bold text-slate-900 line-clamp-1">
                      {item.item_name}
                    </h3>

                    {/* Description */}
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {item.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Metadata Footer */}
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span>📍</span>
                      <span className="font-medium text-slate-700">
                        {item._type === 'lost' ? item.lost_location : item.found_location}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>{item._type === 'lost' ? item.lost_date : item.found_date}</span>
                      </div>

                      {item.created_at && (
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {item._type === 'found' && item.current_custody && (
                      <div className="mt-2 rounded bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800">
                        🛡️ Custody: {item.current_custody}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white px-6 py-20 md:px-16">
        <div className="mx-auto max-w-5xl text-center">

          <h2 className="text-3xl font-bold md:text-4xl">
            How FindIt Works
          </h2>

          <p className="mt-4 text-slate-600">
            A simple process to reconnect people with their belongings.
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-3">

            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                01
              </div>
              <h3 className="mt-5 font-bold">Report</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Submit details about a lost or found item.
              </p>
            </div>

            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                02
              </div>
              <h3 className="mt-5 font-bold">Connect</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Find possible matches and coordinate recovery.
              </p>
            </div>

            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                03
              </div>
              <h3 className="mt-5 font-bold">Recover</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Verify ownership and confirm the item's return.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 px-6 py-8 text-center text-sm text-slate-400">
        <p className="text-lg font-bold text-white">FindIt.</p>
        <p className="mt-2">Making campus recovery simpler and organised.</p>
        <p className="mt-5">© 2026 FindIt. Campus Item Recovery System.</p>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab={authModalTab}
      />

    </div>
  )
}

export default App
