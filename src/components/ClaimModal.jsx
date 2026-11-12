import { useState, useEffect } from 'react'
import { submitRecoveryClaim, submitStaffCollectionRequest } from '../services/recoveryService.js'
import { supabase } from '../supabase.js'

export default function ClaimModal({
  isOpen,
  onClose,
  item,
  onSuccess,
  onOpenSignIn,
  user,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [proofDescription, setProofDescription] = useState('')
  const [selectedLostReportId, setSelectedLostReportId] = useState('')
  const [myLostReports, setMyLostReports] = useState([])
  const [loadingLost, setLoadingLost] = useState(false)

  const isStaffCustody = Boolean(item?.is_unregistered_custodian)
  const isFinderOfItem = Boolean(user?.id && item?.finder_id && String(user.id) === String(item.finder_id))

  // Fetch claimant's open lost reports so they can optionally link one
  useEffect(() => {
    if (isOpen && user?.id) {
      setLoadingLost(true)
      supabase
        .from('lost_reports')
        .select('id, item_name, lost_date')
        .eq('reporter_id', user.id)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setMyLostReports(data || [])
          setLoadingLost(false)
        })
        .catch(() => {
          setLoadingLost(false)
        })
    }
  }, [isOpen, user?.id])

  if (!isOpen || !item) return null

  const resetForm = () => {
    setProofDescription('')
    setSelectedLostReportId('')
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
      setError('You must be signed in to submit a claim or collection request.')
      onOpenSignIn?.()
      return
    }

    if (isFinderOfItem) {
      setError('Unauthorized: As the original finder, you cannot submit a recovery or collection request on your own report.')
      return
    }

    if (!proofDescription.trim()) {
      setError('Please provide verifiable proof of ownership.')
      return
    }

    if (proofDescription.trim().length < 15) {
      setError('Please provide a more detailed proof description (at least 15 characters).')
      return
    }

    try {
      setLoading(true)
      if (isStaffCustody) {
        await submitStaffCollectionRequest({
          foundItemId: item.id,
          proofDescription,
          lostReportId: selectedLostReportId || null,
        })
      } else {
        await submitRecoveryClaim({
          foundItemId: item.id,
          proofDescription,
          lostReportId: selectedLostReportId || null,
        })
      }

      setSuccess(true)
      if (onSuccess) onSuccess()

      setTimeout(() => {
        handleClose()
      }, 1600)
    } catch (err) {
      console.error('Error submitting claim/collection request:', err)
      setError(err.message || 'Failed to submit request. You may have an existing active request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
              isStaffCustody ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-700'
            }`}>
              {isStaffCustody ? '🏛️' : '🛡️'}
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              {isStaffCustody ? 'Collect from Campus Office' : 'Claim Discovered Item'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Item Summary Card */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {isStaffCustody ? 'Staff-Held Item' : 'Item to claim'}
              </p>
              <h3 className="text-base font-bold text-slate-900">
                {item.item_name}
              </h3>
            </div>
            <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              isStaffCustody ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {item.category}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <div>
              <span className="font-medium text-slate-500">Found Location: </span>
              <span className="font-semibold text-slate-800">{item.found_location}</span>
            </div>
            <div>
              <span className="font-medium text-slate-500">Date: </span>
              <span className="font-semibold text-slate-800">{item.found_date}</span>
            </div>
          </div>

          {isStaffCustody && (
            <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/70 p-2.5 text-xs text-purple-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>📍</span>
                <span>Office Location: {item.unregistered_custodian_location || 'Campus Security / Central Office'}</span>
              </div>
              <div className="text-[11px] text-purple-800">
                Staff In-Charge: <strong>{item.unregistered_custodian_name || 'Campus Staff'}</strong>
                {item.unregistered_custodian_role ? ` (${item.unregistered_custodian_role})` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Privacy Note */}
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 border border-amber-200">
          <p className="font-semibold">🔒 Blind Proof Verification</p>
          <p className="mt-0.5">
            {isStaffCustody
              ? 'Provide clear proof of ownership. Campus staff will verify these details against the physical item when you present your ID at the campus office.'
              : 'Your proof description is visible only to the verified current custodian. Include details not shown publicly, such as stickers, scratches, lock screen images, contents, or serial prefixes.'}
          </p>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {isFinderOfItem && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200">
            ⚠️ You originally found and reported this item. As the finder, you cannot submit a collection request on your own report.
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
            {isStaffCustody
              ? `✓ Collection request registered! Please visit ${item.unregistered_custodian_location || 'the campus office'} with your ID to collect your item.`
              : '✓ Recovery claim submitted successfully! The custodian will review your proof.'}
          </div>
        )}

        {/* Claim / Collection Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Proof of Ownership <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={proofDescription}
              onChange={(e) => setProofDescription(e.target.value)}
              placeholder="Describe unique, unpublicized characteristics: e.g. blue phone case with a cracked corner, debit card ending in 4021 inside wallet, custom keychain with initials..."
              disabled={loading || success || isFinderOfItem}
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {proofDescription.trim().length} chars (min 15)
            </p>
          </div>

          {/* Optional Link to User's Existing Lost Report */}
          {user && myLostReports.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Link to your existing Lost Report (Optional)
              </label>
              <select
                value={selectedLostReportId}
                onChange={(e) => setSelectedLostReportId(e.target.value)}
                disabled={loading || success || loadingLost || isFinderOfItem}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50"
              >
                <option value="">-- None (Submit independent request) --</option>
                {myLostReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    Lost: {report.item_name} ({report.lost_date})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Linking helps reconcile your report when ownership is confirmed.
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || success || isFinderOfItem}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 ${
                isStaffCustody
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {loading
                ? 'Submitting...'
                : success
                ? 'Submitted ✓'
                : isStaffCustody
                ? 'Submit Collection Request'
                : 'Submit Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
