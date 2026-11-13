import { supabase } from '../supabase.js'

/**
 * Submit an independent recovery claim on a found item
 */
export async function submitRecoveryClaim({ foundItemId, proofDescription, lostReportId = null }) {
  if (!foundItemId) throw new Error('Missing found item reference.')
  if (!proofDescription || !proofDescription.trim()) {
    throw new Error('Please provide proof of ownership.')
  }

  const { data, error } = await supabase.rpc('submit_recovery_claim', {
    p_found_item_id: String(foundItemId).trim(),
    p_proof_description: proofDescription.trim(),
    p_lost_report_id: lostReportId ? String(lostReportId).trim() : null,
  })

  if (error) throw error
  return { success: true, claimId: data }
}

/**
 * Fetch claimant's own recovery claims
 * Uses secure my_recovery_claims view with safe fallback to recovery_requests joined with safe item info
 */
export async function fetchMyClaims() {
  // 1. Try secure my_recovery_claims view if available
  try {
    const { data, error } = await supabase
      .from('my_recovery_claims')
      .select('*')
      .order('submitted_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return { claims: data, error: null }
    }
  } catch (err) {
    console.warn('my_recovery_claims view notice, falling back:', err.message)
  }

  // 2. Direct query on recovery_requests (scoped to claimant by RLS), joining safe public found_reports fields
  const { data, error } = await supabase
    .from('recovery_requests')
    .select(`
      id,
      found_item_id,
      proof_description,
      status,
      custodian_response_note,
      rejected_at,
      rejected_until,
      created_at,
      found_reports (
        id,
        item_name,
        category,
        found_location,
        found_date
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { claims: [], error: error.message }
  }

  const normalized = (data || []).map((c) => ({
    ...c,
    item_name: c.found_reports?.item_name || `Found Item #${c.found_item_id}`,
    category: c.found_reports?.category || 'General',
    found_location: c.found_reports?.found_location || '',
    found_date: c.found_reports?.found_date || '',
  }))

  return { claims: normalized, error: null }
}

/**
 * Fetch incoming recovery requests for items where the current user is active custodian
 * Excludes requests submitted by the logged-in claimant themselves
 */
export async function fetchIncomingClaimsForCustodian(userId = null) {
  let effectiveUserId = userId
  if (!effectiveUserId) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      effectiveUserId = authData?.user?.id || null
    } catch {
      effectiveUserId = null
    }
  }

  let query = supabase
    .from('recovery_requests')
    .select(`
      id,
      found_item_id,
      claimant_id,
      lost_report_id,
      proof_description,
      status,
      custodian_response_note,
      rejected_at,
      rejected_until,
      created_at,
      found_reports (
        id,
        item_name,
        category,
        found_location,
        found_date
      )
    `)
    .order('created_at', { ascending: false })

  if (effectiveUserId) {
    query = query.neq('claimant_id', effectiveUserId)
  }

  const { data, error } = await query

  if (error) {
    return { claims: [], error: error.message }
  }

  // Defensively exclude any requests authored by the current claimant
  const filteredData = effectiveUserId
    ? (data || []).filter((c) => String(c.claimant_id) !== String(effectiveUserId))
    : data || []

  const normalized = filteredData.map((c) => ({
    ...c,
    item_name: c.found_reports?.item_name || `Found Item #${c.found_item_id}`,
    category: c.found_reports?.category || 'General',
    found_location: c.found_reports?.found_location || '',
    found_date: c.found_reports?.found_date || '',
  }))

  return { claims: normalized, error: null }
}

/**
 * Custodian approves a claimant's recovery request
 */
export async function approveRecoveryClaim(claimId, custodianNote) {
  if (!claimId) throw new Error('Missing claim ID.')
  const { data, error } = await supabase.rpc('approve_recovery_claim', {
    p_claim_id: claimId,
    p_custodian_note: custodianNote?.trim() || 'Claim approved. Ready for physical handover.',
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Custodian temporarily rejects a claim with cooldown (1 to 24h)
 */
export async function temporaryRejectClaim(claimId, reason, cooldownHours = 24) {
  if (!claimId) throw new Error('Missing claim ID.')
  if (!reason || !reason.trim()) throw new Error('Rejection reason is required.')

  const { data, error } = await supabase.rpc('temporary_reject_claim', {
    p_claim_id: claimId,
    p_reason: reason.trim(),
    p_cooldown_hours: Math.min(Math.max(Number(cooldownHours) || 24, 1), 24),
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Claimant resubmits updated proof after cooldown expires
 */
export async function resubmitClaimAfterCooldown(claimId, updatedProof) {
  if (!claimId) throw new Error('Missing claim ID.')
  if (!updatedProof || !updatedProof.trim()) {
    throw new Error('Please provide updated proof details.')
  }

  const { data, error } = await supabase.rpc('resubmit_claim_after_cooldown', {
    p_claim_id: claimId,
    p_updated_proof: updatedProof.trim(),
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Claimant cancels their own active recovery claim
 */
export async function cancelMyRecoveryClaim(claimId) {
  if (!claimId) throw new Error('Missing claim ID.')
  const { data, error } = await supabase.rpc('cancel_my_recovery_claim', {
    p_claim_id: claimId,
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Custodian marks item as physically released to approved owner
 * Seamlessly supports both registered custodian releases and campus staff handovers
 */
export async function releaseItemToOwner(claimId, handoverNotes) {
  if (!claimId) throw new Error('Missing claim ID.')
  const { data, error } = await supabase.rpc('custodian_release_item_to_owner', {
    p_claim_id: claimId,
    p_handover_notes: handoverNotes?.trim() || 'Item physically handed over to verified owner.',
  })

  if (error) {
    if (
      error.message?.includes('unregistered custody') ||
      error.message?.includes('Caller is not the current active custodian') ||
      error.message?.includes('unregistered custodian')
    ) {
      const staffRes = await supabase.rpc('staff_handover_item_to_owner', {
        p_request_id: claimId,
        p_staff_notes: handoverNotes?.trim() || 'Staff confirmed physical handover to owner at campus office.',
      })
      if (staffRes.error) throw staffRes.error
      return { success: true, result: staffRes.data }
    }
    throw error
  }
  return { success: true, result: data }
}

/**
 * Owner confirms physical receipt, finalizing item recovery to RESOLVED
 * Seamlessly supports both peer claim confirmations and campus staff collection receipts
 */
export async function confirmClaimRecovery(claimId) {
  if (!claimId) throw new Error('Missing claim ID.')
  const { data, error } = await supabase.rpc('confirm_claim_recovery', {
    p_claim_id: claimId,
  })

  if (error) {
    if (
      error.message?.includes('unregistered custody') ||
      error.message?.includes('Custody mismatch') ||
      error.message?.includes('unregistered custodian')
    ) {
      const staffRes = await supabase.rpc('confirm_staff_collection_receipt', {
        p_request_id: claimId,
      })
      if (staffRes.error) throw staffRes.error
      return { success: true, result: staffRes.data }
    }
    throw error
  }
  return { success: true, result: data }
}

/**
 * Custodian revokes previous claim approval
 */
export async function revokeClaimApproval(claimId, reason) {
  if (!claimId) throw new Error('Missing claim ID.')
  if (!reason || !reason.trim()) throw new Error('Reason is required to revoke approval.')

  const { data, error } = await supabase.rpc('custodian_revoke_claim_approval', {
    p_claim_id: claimId,
    p_reason: reason.trim(),
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Submit an official collection request for an item held by campus staff/security
 */
export async function submitStaffCollectionRequest({ foundItemId, proofDescription, lostReportId = null }) {
  if (!foundItemId) throw new Error('Missing found item reference.')
  if (!proofDescription || !proofDescription.trim()) {
    throw new Error('Please provide verifiable proof of ownership for campus office collection.')
  }

  const { data, error } = await supabase.rpc('submit_staff_collection_request', {
    p_found_item_id: String(foundItemId).trim(),
    p_proof_description: proofDescription.trim(),
    p_lost_report_id: lostReportId ? String(lostReportId).trim() : null,
  })

  if (error) throw error
  return { success: true, requestId: data }
}

/**
 * Authorized campus staff records physical handover of item to owner
 */
export async function staffHandoverItemToOwner({ requestId, staffNotes = null }) {
  if (!requestId) throw new Error('Missing collection request ID.')

  const { data, error } = await supabase.rpc('staff_handover_item_to_owner', {
    p_request_id: requestId,
    p_staff_notes: staffNotes?.trim() || null,
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Owner confirms physical receipt from campus office, finalizing recovery to RESOLVED
 */
export async function confirmStaffCollectionReceipt(requestId) {
  if (!requestId) throw new Error('Missing collection request ID.')

  const { data, error } = await supabase.rpc('confirm_staff_collection_receipt', {
    p_request_id: requestId,
  })

  if (error) throw error
  return { success: true, result: data }
}
