import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchMyClaims,
  fetchIncomingClaimsForCustodian,
  approveRecoveryClaim,
  temporaryRejectClaim,
  resubmitClaimAfterCooldown,
  cancelMyRecoveryClaim,
  releaseItemToOwner,
  confirmClaimRecovery,
  revokeClaimApproval,
} from '../services/recoveryService'
import {
  lookupMemberByFinditId,
  initiateRegisteredTransfer,
  acceptRegisteredTransfer,
  cancelRegisteredTransfer,
  recordUnregisteredTransfer,
  fetchUserTransfers,
  fetchItemCustodyHistory,
} from '../services/custodyService'
import {
  fetchUserReports,
  closeMyLostReport,
} from '../services/reportService'

export default function Dashboard({
  onOpenLostModal,
  onOpenFoundModal,
}) {
  const { user, profile, updateProfile } = useAuth()

  // Active dashboard tab
  const [activeTab, setActiveTab] = useState('my-claims') // 'my-claims' | 'custody' | 'transfers' | 'my-lost'

  // Loading states
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: string }

  // Data states
  const [myClaims, setMyClaims] = useState([])
  const [incomingClaims, setIncomingClaims] = useState([])
  const [myFoundItems, setMyFoundItems] = useState([])
  const [myLostItems, setMyLostItems] = useState([])
  const [transfers, setTransfers] = useState({ incoming: [], outgoing: [] })

  // Action Modals State
  const [activeActionModal, setActiveActionModal] = useState(null) // 'approve' | 'reject' | 'release' | 'resubmit' | 'transfer'
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [selectedFoundItem, setSelectedFoundItem] = useState(null)

  // Form states for modals
  const [modalInputText, setModalInputText] = useState('')
  const [modalCooldownHours, setModalCooldownHours] = useState(24)

  // Custody transfer form states
  const [transferMode, setTransferMode] = useState('registered') // 'registered' | 'unregistered'
  const [targetFinditId, setTargetFinditId] = useState('')
  const [lookedUpMember, setLookedUpMember] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [unregStaffName, setUnregStaffName] = useState('')
  const [unregStaffRole, setUnregStaffRole] = useState('Campus Security')
  const [unregLocation, setUnregLocation] = useState('')
  const [transferNotes, setTransferNotes] = useState('')

  // Academic details update modal state
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false)
  const [editCourse, setEditCourse] = useState('')
  const [editCustomCourse, setEditCustomCourse] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editSection, setEditSection] = useState('')
  const [academicSaving, setAcademicSaving] = useState(false)
  const [academicModalError, setAcademicModalError] = useState(null)

  // Custody timeline viewer state (Bug 1)
  const [timelineItem, setTimelineItem] = useState(null)
  const [timelineEvents, setTimelineEvents] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState(null)

  const handleOpenTimeline = async (item) => {
    setTimelineItem(item)
    setTimelineLoading(true)
    setTimelineError(null)
    setTimelineEvents([])
    try {
      const targetId = item.id || item.found_item_id
      const res = await fetchItemCustodyHistory(targetId)
      if (res.error) {
        setTimelineError(res.error)
      } else {
        setTimelineEvents(res.history || [])
      }
    } catch (err) {
      setTimelineError(err.message || 'Failed to load custody timeline.')
    } finally {
      setTimelineLoading(false)
    }
  }

  const handleCloseTimeline = () => {
    setTimelineItem(null)
    setTimelineEvents([])
    setTimelineError(null)
  }

  const KNOWN_COURSES = ['MCA', 'BCA', 'BBA', 'MBA']
  const hasMissingAcademicInfo = !profile?.course || !profile?.academic_year || !profile?.section

  const handleOpenAcademicModal = () => {
    setAcademicModalError(null)
    const currentCourse = profile?.course || ''
    if (currentCourse && !KNOWN_COURSES.includes(currentCourse)) {
      setEditCourse('Other')
      setEditCustomCourse(currentCourse)
    } else {
      setEditCourse(currentCourse)
      setEditCustomCourse('')
    }
    setEditYear(profile?.academic_year || '')
    setEditSection(profile?.section || '')
    setIsAcademicModalOpen(true)
  }

  const handleSaveAcademicDetails = async (e) => {
    e.preventDefault()
    setAcademicModalError(null)

    if (!editCourse) {
      setAcademicModalError('Please select your course.')
      return
    }

    if (editCourse === 'Other' && !editCustomCourse.trim()) {
      setAcademicModalError('Please specify your custom course name.')
      return
    }

    if (!editYear) {
      setAcademicModalError('Please select your academic year.')
      return
    }

    if (!editSection.trim()) {
      setAcademicModalError('Please enter your section.')
      return
    }

    const effectiveCourse = editCourse === 'Other' ? editCustomCourse.trim() : editCourse

    try {
      setAcademicSaving(true)
      await updateProfile({
        course: effectiveCourse,
        academic_year: editYear,
        section: editSection.trim().toUpperCase(),
      })
      setIsAcademicModalOpen(false)
      setFeedback({
        type: 'success',
        message: 'Academic profile details updated successfully.',
      })
    } catch (err) {
      setAcademicModalError(err.message || 'Failed to update academic details.')
    } finally {
      setAcademicSaving(false)
    }
  }

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      const [claimsRes, incomingRes, reportsRes, transfersRes] = await Promise.all([
        fetchMyClaims(),
        fetchIncomingClaimsForCustodian(user.id),
        fetchUserReports(user.id),
        fetchUserTransfers(user.id),
      ])

      setMyClaims(claimsRes.claims || [])
      // Defensively ensure claimant's own recovery requests are never present in incoming claims
      const genuineIncoming = (incomingRes.claims || []).filter(
        (c) => !user?.id || String(c.claimant_id) !== String(user.id)
      )
      setIncomingClaims(genuineIncoming)
      setMyFoundItems(reportsRes.myFound || [])
      setMyLostItems(reportsRes.myLost || [])
      setTransfers(transfersRes)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setFeedback({ type: 'error', message: 'Failed to load some dashboard records.' })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Lookup member by FindIt ID
  const handleLookupMember = async () => {
    if (!targetFinditId.trim()) return
    setLookupLoading(true)
    setLookupError(null)
    setLookedUpMember(null)

    try {
      const member = await lookupMemberByFinditId(targetFinditId.trim())
      if (member) {
        setLookedUpMember(member)
      } else {
        setLookupError('No registered campus member found with this FindIt ID.')
      }
    } catch (err) {
      setLookupError(err.message || 'Lookup failed.')
    } finally {
      setLookupLoading(false)
    }
  }

  // --- CLAIMANT ACTIONS ---

  const handleCancelClaim = async (claimId) => {
    if (!confirm('Are you sure you want to cancel this recovery claim?')) return
    setActionLoading(true)
    try {
      await cancelMyRecoveryClaim(claimId)
      setFeedback({ type: 'success', message: 'Recovery claim cancelled successfully.' })
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to cancel claim.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmRecovery = async (claimId) => {
    if (!confirm('Confirm that you have physically received your item? This will mark the recovery as finalized.')) return
    setActionLoading(true)
    try {
      await confirmClaimRecovery(claimId)
      setFeedback({ type: 'success', message: 'Congratulations! Item recovery confirmed and finalized.' })
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to confirm recovery.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleResubmitClaim = async (e) => {
    e.preventDefault()
    if (!modalInputText.trim()) return
    setActionLoading(true)
    try {
      await resubmitClaimAfterCooldown(selectedClaim.id, modalInputText)
      setFeedback({ type: 'success', message: 'Updated proof submitted successfully for custodian review.' })
      setActiveActionModal(null)
      setSelectedClaim(null)
      setModalInputText('')
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to resubmit claim.' })
    } finally {
      setActionLoading(false)
    }
  }

  // --- CUSTODIAN ACTIONS ---

  const handleApproveClaim = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      await approveRecoveryClaim(selectedClaim.id, modalInputText)
      setFeedback({ type: 'success', message: 'Claim approved! Claimant will be notified with your instructions.' })
      setActiveActionModal(null)
      setSelectedClaim(null)
      setModalInputText('')
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to approve claim.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectClaim = async (e) => {
    e.preventDefault()
    if (!modalInputText.trim()) {
      alert('Please provide a reason for the temporary rejection.')
      return
    }
    setActionLoading(true)
    try {
      await temporaryRejectClaim(selectedClaim.id, modalInputText, modalCooldownHours)
      setFeedback({ type: 'success', message: `Claim temporarily rejected with ${modalCooldownHours}h cooldown.` })
      setActiveActionModal(null)
      setSelectedClaim(null)
      setModalInputText('')
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reject claim.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReleaseItem = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      await releaseItemToOwner(selectedClaim.id, modalInputText)
      setFeedback({ type: 'success', message: 'Item recorded as released to owner! Awaiting final owner confirmation.' })
      setActiveActionModal(null)
      setSelectedClaim(null)
      setModalInputText('')
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to release item.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevokeApproval = async (claimId) => {
    const reason = prompt('Please enter reason for revoking approval:')
    if (!reason || !reason.trim()) return
    setActionLoading(true)
    try {
      await revokeClaimApproval(claimId, reason)
      setFeedback({ type: 'success', message: 'Claim approval revoked.' })
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to revoke approval.' })
    } finally {
      setActionLoading(false)
    }
  }

  // --- CUSTODY TRANSFER ACTIONS ---

  const handleInitiateTransferSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFoundItem) return
    setActionLoading(true)

    try {
      if (transferMode === 'registered') {
        if (!targetFinditId.trim()) {
          alert('Please enter recipient FindIt ID.')
          setActionLoading(false)
          return
        }

        const cleanFinditId = targetFinditId.trim().toUpperCase()
        let recipientName = lookedUpMember?.findit_id === cleanFinditId ? lookedUpMember.full_name : null

        if (!recipientName) {
          try {
            const memberRes = await lookupMemberByFinditId(cleanFinditId)
            if (memberRes?.member?.full_name) {
              recipientName = memberRes.member.full_name
            }
          } catch {
            // lookup fallback
          }
        }

        const cleanRecipientName = recipientName || 'Campus Member'
        const notePrefix = `Transferred to ${cleanRecipientName} (ID: ${cleanFinditId})`
        const finalNotes = transferNotes.trim() ? `${notePrefix} | ${transferNotes.trim()}` : notePrefix

        await initiateRegisteredTransfer({
          foundItemId: selectedFoundItem.id,
          recipientFinditId: cleanFinditId,
          notes: finalNotes,
        })
        setFeedback({
          type: 'success',
          message: `Custody transfer initiated to ${cleanRecipientName} (${cleanFinditId})! Recipient must accept to complete.`,
        })
      } else {
        if (!unregStaffName.trim()) {
          alert('Please provide the recipient staff member name.')
          setActionLoading(false)
          return
        }
        await recordUnregisteredTransfer({
          foundItemId: selectedFoundItem.id,
          recipientName: unregStaffName,
          recipientRole: unregStaffRole,
          location: unregLocation,
          notes: transferNotes,
        })
        setFeedback({
          type: 'success',
          message: `Physical custody handover to ${unregStaffName.trim()} (${unregStaffRole}) recorded.`,
        })
      }

      setActiveActionModal(null)
      setSelectedFoundItem(null)
      setTargetFinditId('')
      setLookedUpMember(null)
      setTransferNotes('')
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Transfer failed.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptTransfer = async (transferId) => {
    if (!confirm('Accept custody of this item? You will become its active verified custodian.')) return
    setActionLoading(true)
    try {
      await acceptRegisteredTransfer(transferId)
      setFeedback({ type: 'success', message: 'Custody transfer accepted! You are now the active custodian.' })
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept transfer.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelTransfer = async (transferId) => {
    if (!confirm('Cancel this pending custody transfer?')) return
    setActionLoading(true)
    try {
      await cancelRegisteredTransfer(transferId)
      setFeedback({ type: 'success', message: 'Transfer cancelled.' })
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to cancel transfer.' })
    } finally {
      setActionLoading(false)
    }
  }

  // --- LOST REPORT ACTIONS ---

  const handleCloseLostReport = async (reportId) => {
    if (!confirm('Mark this lost report as closed/resolved?')) return
    setActionLoading(true)
    try {
      await closeMyLostReport(reportId)
      setFeedback({ type: 'success', message: 'Lost item report marked as closed.' })
      await loadDashboardData()
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to close report.' })
    } finally {
      setActionLoading(false)
    }
  }

  // Helper: Status badge renderer
  const renderStatusBadge = (status) => {
    const s = (status || '').toUpperCase()
    switch (s) {
      case 'PENDING':
        return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Pending Review</span>
      case 'ACCEPTED':
        return <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">Approved / Ready</span>
      case 'TEMPORARILY_REJECTED':
        return <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">Temporarily Rejected</span>
      case 'RELEASED_TO_OWNER':
        return <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">Released (Pending Confirmation)</span>
      case 'CONFIRMED_RECOVERED':
      case 'CONFIRMED_BY_OWNER':
      case 'RESOLVED':
      case 'RECOVERED':
        return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Recovered ✓</span>
      case 'CANCELLED':
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">Cancelled</span>
      case 'OPEN':
        return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">Open</span>
      case 'CLOSED':
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">Closed</span>
      default:
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{status}</span>
    }
  }

  // --- CUSTODY & TRANSFER DERIVED STATES ---

  // Helper to parse transfer recipient details
  const parseTransferRecipient = (t) => {
    if (!t) return null
    if (t.transfer_mode === 'UNREGISTERED') {
      return {
        type: 'unregistered',
        recipientName: t.unregistered_recipient_name || 'Campus Staff',
        recipientRole: t.unregistered_recipient_role || 'Staff Member',
        location: t.unregistered_location || '',
        date: t.resolved_at || t.created_at,
        notes: t.notes || '',
        status: t.status,
      }
    }

    const notesStr = t.notes || ''
    const match = notesStr.match(/^Transferred to (.+?) \(ID: ([^)]+)\)(?: \| (.*))?$/)
    if (match) {
      return {
        type: 'registered',
        recipientName: match[1],
        finditId: match[2],
        userNotes: match[3] || '',
        date: t.resolved_at || t.created_at,
        status: t.status,
      }
    }

    return {
      type: 'registered',
      recipientName: 'Registered Member',
      finditId: null,
      userNotes: notesStr,
      date: t.resolved_at || t.created_at,
      status: t.status,
    }
  }

  const getTransferDetailsForItem = (itemId) => {
    const t = transfers.outgoing.find((tr) => String(tr.found_item_id) === String(itemId))
    return parseTransferRecipient(t)
  }

  // Strictly pending transfers counts (only PENDING status, never accepted or cancelled)
  const pendingIncomingTransfers = transfers.incoming.filter((t) => t.status === 'PENDING')
  const pendingOutgoingTransfers = transfers.outgoing.filter((t) => t.status === 'PENDING')
  const pendingTransfersCount = pendingIncomingTransfers.length + pendingOutgoingTransfers.length

  // Active Custody: Item is OPEN, authenticated user is current_custodian_id, and not unregistered
  const activeCustodyItems = myFoundItems.filter((item) => {
    return (
      item.status === 'OPEN' &&
      item.current_custodian_id === user?.id &&
      !item.is_unregistered_custodian
    )
  })

  // Transferred / Handed Over: Held/found by user previously, but custody transferred to someone else
  const transferredItems = myFoundItems.filter((item) => {
    if (item.status === 'RESOLVED' || item.status === 'CLOSED') return false

    // A: Handed over to unregistered staff
    if (item.is_unregistered_custodian) return true

    // B: Transferred to another registered member and current_custodian_id is someone else
    if (item.current_custodian_id && item.current_custodian_id !== user?.id) return true

    // C: Outgoing transfer accepted or manually recorded
    const hasOutgoingHandover = transfers.outgoing.some(
      (t) =>
        String(t.found_item_id) === String(item.id) &&
        (t.status === 'ACCEPTED' || t.status === 'MANUALLY_RECORDED')
    )
    if (hasOutgoingHandover && item.current_custodian_id !== user?.id) return true

    return false
  })

  // Resolved / Closed Items: Officially recovered by owner or closed
  const resolvedItems = myFoundItems.filter((item) => {
    return item.status === 'RESOLVED' || item.status === 'CLOSED'
  })

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Profile Header Summary */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-2xl font-black text-white shadow-md">
                {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                    {profile?.full_name || 'Campus Member'}
                  </h1>
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                    {profile?.member_type || 'STUDENT'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono font-bold text-slate-700">
                    ID: {profile?.findit_id || 'Generating...'}
                  </span>
                  <span>•</span>
                  <span>{user?.email}</span>
                </div>

                {/* Academic Profile Details */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  {profile?.course && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-700/10">
                      <span>🎓</span>
                      <span>{profile.course}</span>
                      {profile?.academic_year && <span>• {profile.academic_year} Year</span>}
                      {profile?.section && <span>• Sec {profile.section}</span>}
                    </span>
                  )}

                  {hasMissingAcademicInfo ? (
                    <button
                      type="button"
                      onClick={handleOpenAcademicModal}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-amber-600/20 hover:bg-amber-100 transition cursor-pointer"
                    >
                      <span>⚠️ Complete Academic Info</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenAcademicModal}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-700 underline underline-offset-2 transition cursor-pointer"
                    >
                      Edit Academic Info
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenLostModal}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition"
              >
                + Report Lost
              </button>
              <button
                type="button"
                onClick={onOpenFoundModal}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
              >
                + Report Found
              </button>
              <button
                type="button"
                onClick={loadDashboardData}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                title="Refresh dashboard"
              >
                <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
              </button>
            </div>
          </div>

          {/* Missing Academic Info Alert Banner */}
          {hasMissingAcademicInfo && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
              <div className="flex items-center gap-2.5">
                <span className="text-base">⚠️</span>
                <span>
                  <strong>Academic Profile Incomplete:</strong> Add your course, academic year, and section to help verify your campus identity during item recovery and handovers.
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenAcademicModal}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-amber-700 transition cursor-pointer"
              >
                Complete Academic Info
              </button>
            </div>
          )}

          {/* Quick Stat Counters */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-6 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">My Claims</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{myClaims.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Items In Custody</p>
              <p className="mt-1 text-2xl font-black text-blue-700">{activeCustodyItems.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Incoming Claims</p>
              <p className="mt-1 text-2xl font-black text-amber-600">{incomingClaims.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Pending Transfers</p>
              <p className="mt-1 text-2xl font-black text-purple-700">{pendingTransfersCount}</p>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`mt-4 rounded-xl p-4 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-8 border-b border-slate-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto pb-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('my-claims')}
              className={`whitespace-nowrap pb-3 border-b-2 transition ${
                activeTab === 'my-claims'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              My Recovery Claims ({myClaims.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custody')}
              className={`whitespace-nowrap pb-3 border-b-2 transition ${
                activeTab === 'custody'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              Items in My Custody & Reports ({activeCustodyItems.length}{resolvedItems.length > 0 ? ` • ${resolvedItems.length} Resolved` : ''})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transfers')}
              className={`whitespace-nowrap pb-3 border-b-2 transition ${
                activeTab === 'transfers'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              Custody Transfers ({pendingTransfersCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my-lost')}
              className={`whitespace-nowrap pb-3 border-b-2 transition ${
                activeTab === 'my-lost'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              My Lost Reports ({myLostItems.length})
            </button>
          </nav>
        </div>

        {/* Tab 1: My Recovery Claims (Claimant Tracker) */}
        {activeTab === 'my-claims' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Track Your Recovery Claims</h2>
                <p className="text-xs text-slate-500">
                  Follow verification status, custodian instructions, and confirm receipt when recovered.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading claims...</div>
            ) : myClaims.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
                  🛡️
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-800">No Recovery Claims Yet</h3>
                <p className="mt-1 text-xs text-slate-500">
                  If you spot an item in the Campus Feed that matches what you lost, click "Claim This Item" to submit proof.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myClaims.map((claim) => {
                  const s = (claim.status || '').toUpperCase()
                  const isPending = s === 'PENDING'
                  const isApproved = s === 'ACCEPTED'
                  const isRejected = s === 'TEMPORARILY_REJECTED'
                  const isReleased = s === 'RELEASED_TO_OWNER'
                  const isRecovered = s === 'CONFIRMED_RECOVERED' || s === 'CONFIRMED_BY_OWNER'

                  // Cooldown check for rejected claims
                  const rejectedUntil = claim.rejected_until ? new Date(claim.rejected_until) : null
                  const isCooldownActive = rejectedUntil && rejectedUntil > new Date()

                  return (
                    <div
                      key={claim.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            Claim #{claim.id}
                          </span>
                          {renderStatusBadge(claim.status)}
                        </div>

                        {/* Item Name & Details */}
                        <div className="mt-3 flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900">
                              {claim.item_name || `Found Item #${claim.found_item_id}`}
                            </h3>
                            {claim.found_location && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                📍 Found near: {claim.found_location} {claim.found_date ? `(${claim.found_date})` : ''}
                              </p>
                            )}
                          </div>
                          {claim.category && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100">
                              {claim.category}
                            </span>
                          )}
                        </div>

                        {/* Proof Description */}
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                          <p className="font-semibold text-slate-500">Your Submitted Proof:</p>
                          <p className="mt-1 italic">{claim.proof_description}</p>
                        </div>

                        {/* Custodian Response Note */}
                        {claim.custodian_response_note && (
                          <div
                            className={`mt-3 rounded-xl p-3 text-xs ${
                              isApproved || isReleased
                                ? 'border border-blue-200 bg-blue-50 text-blue-900'
                                : isRejected
                                ? 'border border-rose-200 bg-rose-50 text-rose-900'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            <p className="font-bold">Custodian Response:</p>
                            <p className="mt-1">{claim.custodian_response_note}</p>
                          </div>
                        )}

                        {/* Cooldown Timer Alert */}
                        {isRejected && isCooldownActive && (
                          <div className="mt-2 text-[11px] text-rose-700">
                            ⏳ Cooldown active until: {rejectedUntil.toLocaleTimeString()} ({rejectedUntil.toLocaleDateString()})
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-5 border-t border-slate-100 pt-3">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleCancelClaim(claim.id)}
                            disabled={actionLoading}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            Cancel Claim
                          </button>
                        )}

                        {isRejected && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClaim(claim)
                              setModalInputText(claim.proof_description || '')
                              setActiveActionModal('resubmit')
                            }}
                            disabled={actionLoading || isCooldownActive}
                            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                          >
                            {isCooldownActive ? 'Cooldown Active' : 'Resubmit Updated Proof'}
                          </button>
                        )}

                        {isReleased && (
                          <button
                            type="button"
                            onClick={() => handleConfirmRecovery(claim.id)}
                            disabled={actionLoading}
                            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                          >
                            ✓ Confirm Physical Receipt & Finalize
                          </button>
                        )}

                        {isRecovered && (
                          <div className="text-center text-xs font-bold text-emerald-700">
                            ✓ Item Officially Recovered!
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Items in My Custody & Incoming Claims */}
        {activeTab === 'custody' && (
          <div className="mt-6 space-y-8">
            
            {/* Section A: Items Currently in Your Care */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Items Currently in Your Care</h2>
                  <p className="text-xs text-slate-500">
                    Open items you actively hold custody for. You can transfer custody or coordinate handovers.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                  {activeCustodyItems.length} active
                </span>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading custody items...</div>
              ) : activeCustodyItems.length === 0 ? (
                <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="text-xs text-slate-500">
                    You do not currently have any active items in your custody.
                  </p>
                  {resolvedItems.length > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                      <span>✓</span>
                      <span>You have {resolvedItems.length} successfully recovered {resolvedItems.length === 1 ? 'item' : 'items'} in your verified history below.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeCustodyItems.map((item) => {
                    const pendingOutgoingForThisItem = transfers.outgoing.find(
                      (t) => String(t.found_item_id) === String(item.id) && t.status === 'PENDING'
                    )

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                              {item.category}
                            </span>
                            {renderStatusBadge(item.status)}
                          </div>

                          <h3 className="mt-3 text-base font-bold text-slate-900">{item.item_name}</h3>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.description}</p>

                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            <div>📍 Found: {item.found_location}</div>
                            <div>🗓️ Date: {item.found_date}</div>
                          </div>

                          {pendingOutgoingForThisItem && (
                            <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-2.5 text-xs text-purple-900">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span>⏳</span>
                                <span>Transfer Pending Acceptance</span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-purple-700">
                                {pendingOutgoingForThisItem.notes || 'Awaiting acceptance by designated recipient.'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Custody Transfer Button: Shown only if OPEN, current_custodian_id === user.id, !is_unregistered_custodian */}
                        {item.status === 'OPEN' && item.current_custodian_id === user?.id && !item.is_unregistered_custodian && (
                          <div className="mt-5 border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFoundItem(item)
                                setActiveActionModal('transfer')
                              }}
                              disabled={actionLoading || Boolean(pendingOutgoingForThisItem)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span>🔄</span>
                              <span>{pendingOutgoingForThisItem ? 'Transfer Pending' : 'Transfer Custody'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Section B: Incoming Claims on My Custody Items */}
            <div className="border-t border-slate-200 pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Incoming Ownership Claims</h2>
                  <p className="text-xs text-slate-500">
                    Review blind proofs submitted by claimants. Verify before approving or handing over.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading claims...</div>
              ) : incomingClaims.length === 0 ? (
                <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="text-xs text-slate-500">
                    No incoming claims for your custody items at this time.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {incomingClaims.map((claim) => {
                    const s = (claim.status || '').toUpperCase()
                    const isPending = s === 'PENDING'
                    const isApproved = s === 'ACCEPTED'
                    const isReleased = s === 'RELEASED_TO_OWNER'
                    const isRecovered = s === 'CONFIRMED_RECOVERED' || s === 'CONFIRMED_BY_OWNER'
                    const isClaimantOfThisRequest = Boolean(
                      user?.id && claim.claimant_id && String(claim.claimant_id) === String(user.id)
                    )

                    return (
                      <div
                        key={claim.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[11px] font-mono font-bold text-slate-400">
                                Claim #{claim.id?.substring(0, 8)}... (Item #{claim.found_item_id})
                              </span>
                              <h4 className="mt-0.5 text-base font-bold text-slate-900">
                                {claim.item_name || `Discovered Item #${claim.found_item_id}`}
                              </h4>
                              {claim.found_location && (
                                <p className="text-xs text-slate-500">
                                  Found at: {claim.found_location}
                                </p>
                              )}
                            </div>
                            {renderStatusBadge(claim.status)}
                          </div>

                          {/* Blind Proof Review Section */}
                          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-800">
                            <p className="font-bold text-blue-900">Claimant Submitted Proof:</p>
                            <p className="mt-1 leading-relaxed text-slate-700 italic">
                              "{claim.proof_description}"
                            </p>
                          </div>

                          {claim.custodian_response_note && (
                            <div className="mt-2 text-xs text-slate-500">
                              <span className="font-semibold">Custodian's note: </span>
                              {claim.custodian_response_note}
                            </div>
                          )}
                        </div>

                        {/* Custodian Claim Review Controls - Shown only for genuine incoming claims, never for claimant's own request */}
                        {!isClaimantOfThisRequest && (
                          <div className="mt-5 border-t border-slate-100 pt-3">
                            {isPending && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClaim(claim)
                                    setModalInputText('Claim approved. Please meet me on campus with student ID.')
                                    setActiveActionModal('approve')
                                  }}
                                  className="flex-1 rounded-xl bg-blue-700 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-800"
                                >
                                  Approve Claim
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClaim(claim)
                                    setModalInputText('')
                                    setActiveActionModal('reject')
                                  }}
                                  className="flex-1 rounded-xl border border-rose-300 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                                >
                                  Reject (Cooldown)
                                </button>
                              </div>
                            )}

                            {isApproved && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClaim(claim)
                                    setModalInputText('Item physically handed over to verified owner.')
                                    setActiveActionModal('release')
                                  }}
                                  className="flex-1 rounded-xl bg-purple-700 py-2 text-xs font-bold text-white shadow-2xs hover:bg-purple-800"
                                >
                                  Release Item to Owner
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeApproval(claim.id)}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                  Revoke
                                </button>
                              </div>
                            )}

                            {isReleased && (
                              <div className="text-center text-xs font-semibold text-purple-700">
                                Item handed over. Awaiting final confirmation from owner.
                              </div>
                            )}

                            {isRecovered && (
                              <div className="text-center text-xs font-bold text-emerald-700">
                                ✓ Successfully recovered & confirmed by owner!
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Section C: Transferred Items & Handover Records */}
            {transferredItems.length > 0 && (
              <div className="border-t border-slate-200 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Transferred Items & Handover Records</h2>
                    <p className="text-xs text-slate-500">
                      Items you previously held that have been transferred to another member or handed over to campus staff.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {transferredItems.length}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {transferredItems.map((item) => {
                    const details = getTransferDetailsForItem(item.id)
                    const isStaff = item.is_unregistered_custodian || details?.type === 'unregistered'
                    const staffName = item.unregistered_custodian_name || details?.recipientName || 'Campus Staff'
                    const staffRole = item.unregistered_custodian_role || details?.recipientRole || 'Staff'
                    const staffLoc = item.unregistered_custodian_location || details?.location

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                              {item.category}
                            </span>
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                              {isStaff ? 'Staff Handover' : 'Transferred'}
                            </span>
                          </div>

                          <h3 className="mt-3 text-base font-bold text-slate-900">{item.item_name}</h3>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>

                          {/* Transfer Confirmation Box */}
                          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-700">
                            {isStaff ? (
                              <div className="space-y-1">
                                <p className="font-bold text-blue-900">
                                  🏛️ Handed over to Campus Staff
                                </p>
                                <p className="text-slate-800">
                                  Staff: <strong>{staffName}</strong> ({staffRole})
                                </p>
                                {staffLoc && (
                                  <p className="text-slate-600">Location: {staffLoc}</p>
                                )}
                                {details?.date && (
                                  <p className="text-[11px] text-slate-500">
                                    Handover Date: {new Date(details.date).toLocaleDateString()} {new Date(details.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="font-bold text-blue-900">
                                  ✓ Transferred to {details?.recipientName || 'Campus Member'}
                                </p>
                                {details?.finditId && (
                                  <p className="font-mono text-blue-800">
                                    FindIt ID: <strong>{details.finditId}</strong>
                                  </p>
                                )}
                                {details?.date && (
                                  <p className="text-[11px] text-slate-500">
                                    Transfer Date: {new Date(details.date).toLocaleDateString()} {new Date(details.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                                {details?.userNotes && (
                                  <p className="text-[11px] italic text-slate-600">"{details.userNotes}"</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Explicit note: NO Transfer Custody button for previous custodian */}
                        <div className="mt-4 border-t border-slate-200 pt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleOpenTimeline(item)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition cursor-pointer"
                          >
                            <span>📜</span>
                            <span>View Custody Chain</span>
                          </button>
                          <span className="text-[11px] font-medium text-slate-400">
                            Custody Relinquished
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Section D: Resolved & Recovered Items History */}
            <div className="border-t border-slate-200 pt-8" id="resolved-found-items-section">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Resolved & Recovered Items</h2>
                  <p className="text-xs text-slate-500">
                    Discovered items you found or managed that have been verified, recovered by owner, or officially closed.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {resolvedItems.length}
                </span>
              </div>

              {resolvedItems.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
                  <div className="text-2xl mb-1">📦</div>
                  <p className="text-xs font-semibold text-slate-700">No resolved or recovered items yet</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    When items you discovered or managed are reunited with their owners and confirmed, they will appear here in your verified recovery record.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resolvedItems.map((item) => {
                    const isFinder = item.finder_id === user?.id
                    const recoveryDate = item.resolved_at || item.updated_at

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                              {item.category}
                            </span>
                            {renderStatusBadge(item.status)}
                          </div>

                          <h3 className="mt-3 text-base font-bold text-slate-900">{item.item_name}</h3>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {item.description || 'No public description provided.'}
                          </p>

                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            {item.found_location && <div>📍 Found at: {item.found_location}</div>}
                            {item.found_date && <div>🗓️ Discovered: {item.found_date}</div>}
                          </div>

                          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span>✓</span>
                              <span>Officially Recovered & Closed</span>
                            </div>
                            <p className="mt-1 text-[11px] text-emerald-700">
                              Recovery Date: {recoveryDate ? new Date(recoveryDate).toLocaleDateString() : 'Confirmed'}
                            </p>
                            {isFinder && (
                              <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                                🌟 You originally found and reported this item
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Explicit note: NO Transfer Custody button for resolved items */}
                        <div className="mt-4 border-t border-slate-100 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleOpenTimeline(item)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 transition cursor-pointer"
                          >
                            <span>📜</span>
                            <span>Custody Chain Trail</span>
                          </button>
                          <span className="font-medium">Case Finalized • Custody Relinquished</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 3: Custody Transfers */}
        {activeTab === 'transfers' && (
          <div className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Audited Custody Transfers</h2>
              <p className="text-xs text-slate-500">
                Track custody chain of custody from discoverer to student custodian or campus staff.
              </p>
            </div>

            {/* Incoming Transfers (User must accept) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-slate-900">
                Incoming Custody Transfer Requests ({pendingIncomingTransfers.length})
              </h3>
              {pendingIncomingTransfers.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">No pending incoming transfers.</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {pendingIncomingTransfers.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {t.item_name || `Discovered Item #${t.found_item_id}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.notes ? `Note: "${t.notes}"` : 'No transfer note provided'}
                        </p>
                        {t.created_at && (
                          <p className="text-[10px] text-slate-400">
                            Requested: {new Date(t.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenTimeline(t)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer shadow-2xs"
                        >
                          📜 Timeline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptTransfer(t.id)}
                          disabled={actionLoading}
                          className="rounded-xl bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                        >
                          Accept Custody
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Transfers */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-slate-900">
                Outgoing Transfer History ({transfers.outgoing.length})
              </h3>
              {transfers.outgoing.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">No outgoing custody transfers initiated.</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {transfers.outgoing.map((t) => {
                    const isUnreg = t.transfer_mode === 'UNREGISTERED'
                    const details = parseTransferRecipient(t)

                    return (
                      <div key={t.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {t.item_name || `Item #${t.found_item_id}`}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              t.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : t.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700'
                                : t.status === 'CANCELLED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {t.status}
                            </span>
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              {isUnreg ? 'Campus Staff Handover' : 'Member Transfer'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {isUnreg ? (
                              <span>
                                Handed to <strong>{t.unregistered_recipient_name || 'Staff'}</strong> ({t.unregistered_recipient_role || 'Staff'}) at {t.unregistered_location || 'Campus'}
                              </span>
                            ) : details?.recipientName ? (
                              <span>
                                Transferred to <strong>{details.recipientName}</strong>
                                {details.finditId ? ` (ID: ${details.finditId})` : ''}
                                {details.userNotes ? ` • "${details.userNotes}"` : ''}
                              </span>
                            ) : (
                              <span>{t.notes || 'Transferred to student/staff'}</span>
                            )}
                          </p>
                          <div className="mt-0.5 flex items-center gap-3 text-[10px] text-slate-400">
                            {t.created_at && (
                              <span>Initiated: {new Date(t.created_at).toLocaleString()}</span>
                            )}
                            {t.resolved_at && (
                              <span>• Resolved: {new Date(t.resolved_at).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTimeline(t)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer shadow-2xs"
                          >
                            📜 Timeline
                          </button>
                          {t.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleCancelTransfer(t.id)}
                              disabled={actionLoading}
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Member Lookup Tool */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-bold text-slate-900">Verify Campus Member by FindIt ID</h3>
              <p className="text-xs text-slate-500">
                Before handing an item over, you can verify any student or staff member's credentials.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={targetFinditId}
                  onChange={(e) => setTargetFinditId(e.target.value.toUpperCase())}
                  placeholder="e.g. STU-A1B2C3"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:border-blue-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleLookupMember}
                  disabled={lookupLoading}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {lookupLoading ? 'Checking...' : 'Verify ID'}
                </button>
              </div>

              {lookupError && (
                <p className="mt-2 text-xs font-medium text-rose-600">{lookupError}</p>
              )}

              {lookedUpMember && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <p className="font-bold">✓ Verified Campus Member</p>
                  <p className="mt-0.5">Name: {lookedUpMember.full_name}</p>
                  <p>Role: {lookedUpMember.member_type}</p>
                  <p className="font-mono">FindIt ID: {lookedUpMember.findit_id}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: My Lost Reports */}
        {activeTab === 'my-lost' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Lost Item Reports</h2>
                <p className="text-xs text-slate-500">
                  Reports you submitted to help find your missing belongings.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLostModal}
                className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                + New Lost Report
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading lost reports...</div>
            ) : myLostItems.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="text-xs text-slate-500">You haven't reported any lost items yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myLostItems.map((report) => {
                  const isOpen = (report.status || 'OPEN').toUpperCase() === 'OPEN'
                  return (
                    <div
                      key={report.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            {report.category}
                          </span>
                          {renderStatusBadge(report.status)}
                        </div>

                        <h3 className="mt-3 text-base font-bold text-slate-900">{report.item_name}</h3>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{report.description}</p>

                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          <div>📍 Lost near: {report.lost_location}</div>
                          <div>🗓️ Date: {report.lost_date}</div>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-slate-100 pt-3">
                        {isOpen ? (
                          <button
                            type="button"
                            onClick={() => handleCloseLostReport(report.id)}
                            disabled={actionLoading}
                            className="w-full rounded-xl border border-slate-300 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Mark as Found / Closed
                          </button>
                        ) : (
                          <div className="text-center text-xs font-bold text-slate-400">
                            Closed ✓
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- ACTION MODALS --- */}

      {/* 1. Approve Claim Modal */}
      {activeActionModal === 'approve' && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Approve Ownership Claim #{selectedClaim.id}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Provide handover instructions for the owner (e.g. campus location and meeting time).
            </p>
            <form onSubmit={handleApproveClaim} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Handover Instructions / Note
                </label>
                <textarea
                  rows={3}
                  value={modalInputText}
                  onChange={(e) => setModalInputText(e.target.value)}
                  placeholder="e.g. Please meet me outside the Central Library at 2:30 PM with your student ID."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {actionLoading ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Reject Claim Modal */}
      {activeActionModal === 'reject' && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Temporary Rejection with Cooldown</h3>
            <p className="mt-1 text-xs text-slate-500">
              Claimant will be prevented from resubmitting for the cooldown duration.
            </p>
            <form onSubmit={handleRejectClaim} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Rejection Reason (Visible to claimant) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={modalInputText}
                  onChange={(e) => setModalInputText(e.target.value)}
                  placeholder="e.g. The color or description does not match the actual item details."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Cooldown Period (Hours)
                </label>
                <select
                  value={modalCooldownHours}
                  onChange={(e) => setModalCooldownHours(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-800"
                >
                  <option value={1}>1 Hour</option>
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (Standard)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Release Item Modal */}
      {activeActionModal === 'release' && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Record Item Handover to Owner</h3>
            <p className="mt-1 text-xs text-slate-500">
              Mark this item as physically released. The claimant must confirm final receipt.
            </p>
            <form onSubmit={handleReleaseItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Handover Notes
                </label>
                <textarea
                  rows={2}
                  value={modalInputText}
                  onChange={(e) => setModalInputText(e.target.value)}
                  placeholder="e.g. Verified college ID in person and returned laptop."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Confirm Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Resubmit Proof Modal */}
      {activeActionModal === 'resubmit' && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Resubmit Updated Proof</h3>
            <p className="mt-1 text-xs text-slate-500">
              Provide additional identifying details for custodian reconsideration.
            </p>
            <form onSubmit={handleResubmitClaim} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Updated Proof Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={modalInputText}
                  onChange={(e) => setModalInputText(e.target.value)}
                  placeholder="Provide additional details..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Resubmit Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Transfer Custody Modal */}
      {activeActionModal === 'transfer' && selectedFoundItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Transfer Custody: {selectedFoundItem.item_name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Hand off responsibility for this item to a registered student/staff or campus security/dept office.
            </p>

            {/* Mode Selector */}
            <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTransferMode('registered')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  transferMode === 'registered' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Registered Member
              </button>
              <button
                type="button"
                onClick={() => setTransferMode('unregistered')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  transferMode === 'unregistered' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Staff / Security Handover
              </button>
            </div>

            <form onSubmit={handleInitiateTransferSubmit} className="mt-4 space-y-3">
              {transferMode === 'registered' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recipient FindIt ID *
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        required
                        value={targetFinditId}
                        onChange={(e) => setTargetFinditId(e.target.value.toUpperCase())}
                        placeholder="e.g. STU-A1B2C3"
                        className="flex-1 rounded-xl border border-slate-300 p-2.5 text-xs font-mono uppercase text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={handleLookupMember}
                        disabled={lookupLoading}
                        className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900"
                      >
                        {lookupLoading ? '...' : 'Verify'}
                      </button>
                    </div>

                    {lookedUpMember && (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        ✓ Recipient: {lookedUpMember.full_name} ({lookedUpMember.member_type})
                      </p>
                    )}
                    {lookupError && (
                      <p className="mt-1 text-xs text-rose-600">{lookupError}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Staff / Officer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={unregStaffName}
                      onChange={(e) => setUnregStaffName(e.target.value)}
                      placeholder="e.g. Guard Ramesh / Mr. Sharma (Dept Office)"
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Role / Position
                    </label>
                    <input
                      type="text"
                      value={unregStaffRole}
                      onChange={(e) => setUnregStaffRole(e.target.value)}
                      placeholder="e.g. Main Gate Security / CS Lab Attendant"
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Physical Storage Location
                    </label>
                    <input
                      type="text"
                      value={unregLocation}
                      onChange={(e) => setUnregLocation(e.target.value)}
                      placeholder="e.g. Gate 1 Security Cabin Drawer 2"
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Transfer Notes
                </label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Additional context about this handover..."
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionModal(null)
                    setSelectedFoundItem(null)
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Transfer Custody'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Academic Info Update Modal */}
      {isAcademicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {hasMissingAcademicInfo ? 'Complete Academic Details' : 'Edit Academic Details'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAcademicModalOpen(false)}
                disabled={academicSaving}
                className="text-xl font-bold text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              These details are saved to your student profile and help custodians verify item claims and coordinate handovers.
            </p>

            {academicModalError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {academicModalError}
              </div>
            )}

            <form onSubmit={handleSaveAcademicDetails} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Course</label>
                <select
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value)}
                  required
                  disabled={academicSaving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
                >
                  <option value="" disabled>Select Course</option>
                  <option value="MCA">MCA</option>
                  <option value="BCA">BCA</option>
                  <option value="BBA">BBA</option>
                  <option value="MBA">MBA</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {editCourse === 'Other' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Specify Course Name</label>
                  <input
                    type="text"
                    value={editCustomCourse}
                    onChange={(e) => setEditCustomCourse(e.target.value)}
                    placeholder="e.g. B.Tech CS, B.Com, M.Sc"
                    required
                    disabled={academicSaving}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Academic Year</label>
                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    required
                    disabled={academicSaving}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
                  >
                    <option value="" disabled>Select Year</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Section</label>
                  <input
                    type="text"
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    placeholder="e.g. A, B, 1"
                    maxLength={10}
                    required
                    disabled={academicSaving}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAcademicModalOpen(false)}
                  disabled={academicSaving}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={academicSaving}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {academicSaving ? 'Saving...' : 'Save Academic Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custody Chain Timeline Modal (Bug 1) */}
      {timelineItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={handleCloseTimeline}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                    📜
                  </span>
                  <h2 className="text-xl font-bold text-slate-900">
                    Custody Chain Audit Trail
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Immutable chronological custody record for{' '}
                  <strong className="text-slate-800">{timelineItem.item_name || `Item #${timelineItem.id || timelineItem.found_item_id}`}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseTimeline}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Timeline Content */}
            <div className="mt-6">
              {timelineLoading && (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Loading custody chain audit history...
                </div>
              )}

              {timelineError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
                  ⚠️ {timelineError}
                </div>
              )}

              {!timelineLoading && !timelineError && timelineEvents.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                  No previous custody transfers recorded for this item.
                </div>
              )}

              {!timelineLoading && !timelineError && timelineEvents.length > 0 && (
                <div className="relative pl-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100 space-y-6">
                  {timelineEvents.map((evt, idx) => {
                    const isStaff = evt.recipient_type === 'UNREGISTERED'
                    const isOfficialRecovery = (evt.notes || '').toLowerCase().includes('officially recovered') || (evt.notes || '').toLowerCase().includes('finalized')

                    return (
                      <div key={evt.history_id || idx} className="relative">
                        {/* Timeline Node Icon */}
                        <div className={`absolute -left-6 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                          isOfficialRecovery
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : isStaff
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                        }`}>
                          {isOfficialRecovery ? '✓' : isStaff ? '🏛️' : idx + 1}
                        </div>

                        {/* Timeline Card */}
                        <div className="ml-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              isOfficialRecovery
                                ? 'bg-emerald-100 text-emerald-800'
                                : isStaff
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isOfficialRecovery
                                ? 'Final Owner Recovery'
                                : isStaff
                                ? 'Handed to Campus Staff'
                                : `Custody Transfer #${idx + 1}`}
                            </span>

                            <span className="text-[11px] text-slate-400">
                              {evt.created_at ? new Date(evt.created_at).toLocaleString() : ''}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-500">Initiator / Actor:</span>
                              <span className="font-medium text-slate-800">{evt.actor_name || 'Campus Member'}</span>
                              {evt.actor_findit_id && (
                                <span className="font-mono text-[10px] font-bold text-slate-500">({evt.actor_findit_id})</span>
                              )}
                            </div>

                            <div className="flex items-start gap-1.5">
                              <span className="font-semibold text-slate-500">Recipient:</span>
                              <div className="font-medium text-slate-800">
                                <span>{evt.recipient_name || 'Campus Member'}</span>
                                {evt.recipient_role && (
                                  <span className="ml-1 text-slate-500">({evt.recipient_role})</span>
                                )}
                                {evt.recipient_findit_id && (
                                  <span className="ml-1 font-mono text-[10px] font-bold text-slate-500">
                                    ID: {evt.recipient_findit_id}
                                  </span>
                                )}
                              </div>
                            </div>

                            {evt.location && (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <span className="font-semibold text-slate-500">Location:</span>
                                <span>📍 {evt.location}</span>
                              </div>
                            )}

                            {evt.notes && (
                              <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] italic text-slate-600 border border-slate-100">
                                "{evt.notes}"
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2 text-[10px] text-slate-400">
                            <span>Status: <strong className="text-emerald-700">{evt.custody_status || 'VERIFIED'}</strong></span>
                            <span className="font-mono">Audit ID: {String(evt.history_id || '').slice(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCloseTimeline}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
