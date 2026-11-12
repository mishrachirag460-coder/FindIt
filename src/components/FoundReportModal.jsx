import { useState } from 'react'
import { submitFoundReport } from '../services/reportService'

const CATEGORIES = [
  'Electronics & Devices',
  'Books & Stationery',
  'Bottles & Drinkware',
  'Bags & Backpacks',
  'Keys & Wallets',
  'Cards & IDs',
  'Clothing & Accessories',
  'Other Items',
]

export default function FoundReportModal({ isOpen, onClose, onSuccess, onOpenSignIn, user }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Public Form fields
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [foundLocation, setFoundLocation] = useState('')
  const [foundDate, setFoundDate] = useState('')

  // Confidential verification fields
  const [secretMarker, setSecretMarker] = useState('')
  const [serialHint, setSerialHint] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')

  if (!isOpen) return null

  const resetForm = () => {
    setItemName('')
    setCategory('')
    setDescription('')
    setFoundLocation('')
    setFoundDate('')
    setSecretMarker('')
    setSerialHint('')
    setPrivateNotes('')
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    if (loading) return
    resetForm()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!user) {
      setError('You must be signed in to submit a found item report.')
      onOpenSignIn?.()
      return
    }

    if (!itemName.trim() || !category || !foundLocation.trim() || !foundDate) {
      setError('Please fill in all required public fields.')
      return
    }

    try {
      setLoading(true)
      await submitFoundReport({
        item_name: itemName,
        category,
        description,
        found_location: foundLocation,
        found_date: foundDate,
        secret_marker: secretMarker,
        serial_number_hint: serialHint,
        private_notes: privateNotes,
      })

      setSuccess(true)
      setItemName('')
      setCategory('')
      setDescription('')
      setFoundLocation('')
      setFoundDate('')
      setSecretMarker('')
      setSerialHint('')
      setPrivateNotes('')
      setTimeout(() => {
        onSuccess?.()
        handleClose()
      }, 1200)
    } catch (err) {
      console.error('Submission error:', err)
      setError(err.message || 'Failed to submit found report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div 
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-lg">📦</span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Report Found Item</h2>
              <p className="text-xs text-slate-500">Register discovered item and record private verification clues.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="text-2xl font-bold text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-30"
          >
            ×
          </button>
        </div>

        {/* Feedback banners */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-700">
            ✓ Found report successfully saved! Live feed is updating...
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          {/* SECTION 1: PUBLIC INFORMATION */}
          <div className="border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Public Details (Visible in Feed)</span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. HP Wireless Mouse (Black)"
              required
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
              >
                <option value="" disabled>Select category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Found Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={foundDate}
                onChange={(e) => setFoundDate(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Found Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              placeholder="e.g. CS Dept Classroom 204 or Cafeteria"
              required
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              General Description
            </label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief general description for the public feed (do NOT write secret markers or passwords here)."
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
            />
          </div>

          {/* SECTION 2: CONFIDENTIAL VERIFICATION CLUES */}
          <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🔒</span>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Private Verification Clues (Confidential)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-purple-700">
              These details are strictly private. They will <strong>NEVER</strong> be displayed in the public feed or shown to claimants. You will use them to verify claimant proof.
            </p>

            <div className="mt-3.5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Secret Marker / Hidden Detail (Optional)
                </label>
                <input
                  type="text"
                  value={secretMarker}
                  onChange={(e) => setSecretMarker(e.target.value)}
                  placeholder="e.g. Small cat sticker inside battery cover, scratch on bottom"
                  disabled={loading}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Serial Number Hint / Partial Identifier (Optional)
                </label>
                <input
                  type="text"
                  value={serialHint}
                  onChange={(e) => setSerialHint(e.target.value)}
                  placeholder="e.g. Ends in ...4829 or Model Number"
                  disabled={loading}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Private Custodian Notes (Optional)
                </label>
                <input
                  type="text"
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  placeholder="e.g. Locked in personal hostel locker or bag contents list"
                  disabled={loading}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? 'Submitting Report...' : 'Submit Found Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
