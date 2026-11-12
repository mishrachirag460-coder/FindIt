import { useState } from 'react'
import { submitLostReport } from '../services/reportService'

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

export default function LostReportModal({ isOpen, onClose, onSuccess, onOpenSignIn, user }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Form states
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [lostLocation, setLostLocation] = useState('')
  const [lostDate, setLostDate] = useState('')

  if (!isOpen) return null

  const resetForm = () => {
    setItemName('')
    setCategory('')
    setDescription('')
    setLostLocation('')
    setLostDate('')
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
      setError('You must be signed in to submit a lost item report.')
      onOpenSignIn?.()
      return
    }

    if (!itemName.trim() || !category || !lostLocation.trim() || !lostDate) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setLoading(true)
      await submitLostReport({
        item_name: itemName,
        category,
        description,
        lost_location: lostLocation,
        lost_date: lostDate,
      })

      setSuccess(true)
      setItemName('')
      setCategory('')
      setDescription('')
      setLostLocation('')
      setLostDate('')
      setTimeout(() => {
        onSuccess?.()
        handleClose()
      }, 1200)
    } catch (err) {
      console.error('Submission error:', err)
      setError(err.message || 'Failed to submit lost report. Please try again.')
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
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-lg">🔍</span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Report Lost Item</h2>
              <p className="text-xs text-slate-500">Post details to the live campus feed so finders can notify you.</p>
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
            ✓ Lost report successfully saved! Live feed is updating...
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Navy Blue Hydro Flask Bottle"
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
                Date Lost <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={lostDate}
                onChange={(e) => setLostDate(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
              >
              </input>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Last Seen Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lostLocation}
              onChange={(e) => setLostLocation(e.target.value)}
              placeholder="e.g. Central Library 2nd Floor Reading Room"
              required
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Description (Optional details)
            </label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include helpful public details (color, brand, visible stickers) so finders can recognize it."
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
            />
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
              className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? 'Submitting Report...' : 'Submit Lost Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
