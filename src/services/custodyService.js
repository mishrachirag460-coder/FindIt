import { supabase } from '../supabase.js'

/**
 * Rate-limited campus member lookup by FindIt ID
 */
export async function lookupMemberByFinditId(finditId) {
  if (!finditId || !finditId.trim()) return null

  const { data, error } = await supabase.rpc('lookup_member_by_findit_id', {
    p_findit_id: finditId.trim().toUpperCase(),
  })

  if (error) throw error
  // Returns array of matching member records
  return data && data.length > 0 ? data[0] : null
}

/**
 * Initiate custody transfer to another registered student/staff by FindIt ID
 */
export async function initiateRegisteredTransfer({ foundItemId, recipientFinditId, notes = '' }) {
  const { data, error } = await supabase.rpc('initiate_registered_custody_transfer', {
    p_found_item_id: String(foundItemId).trim(),
    p_recipient_findit_id: recipientFinditId.trim().toUpperCase(),
    p_notes: notes.trim(),
  })

  if (error) throw error
  return { success: true, transferId: data }
}

/**
 * Recipient accepts pending custody transfer
 */
export async function acceptRegisteredTransfer(transferId) {
  const { data, error } = await supabase.rpc('accept_registered_custody_transfer', {
    p_transfer_id: transferId,
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Sender cancels pending custody transfer
 */
export async function cancelRegisteredTransfer(transferId) {
  const { data, error } = await supabase.rpc('cancel_registered_custody_transfer', {
    p_transfer_id: transferId,
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Record item handover to unregistered campus staff (security guards, dept office)
 */
export async function recordUnregisteredTransfer({
  foundItemId,
  recipientName,
  recipientRole = 'STAFF',
  location = '',
  notes = '',
}) {
  const { data, error } = await supabase.rpc('record_unregistered_custody_transfer', {
    p_found_item_id: String(foundItemId).trim(),
    p_recipient_name: recipientName.trim(),
    p_recipient_role: recipientRole.trim(),
    p_location: location.trim(),
    p_notes: notes.trim(),
  })

  if (error) throw error
  return { success: true, transferId: data }
}

/**
 * Fetch pending custody transfers for the logged-in user (as recipient or sender)
 * Scoped by RLS on public.custody_transfers. Column is created_at.
 */
export async function fetchUserTransfers(userId) {
  if (!userId) return { incoming: [], outgoing: [] }

  try {
    const [inRes, outRes] = await Promise.all([
      supabase
        .from('custody_transfers')
        .select(`
          id,
          found_item_id,
          from_user_id,
          to_user_id,
          transfer_mode,
          status,
          verification_status,
          notes,
          created_at,
          expires_at,
          found_reports (
            id,
            item_name,
            category,
            found_location
          )
        `)
        .eq('to_user_id', userId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false }),
      supabase
        .from('custody_transfers')
        .select(`
          id,
          found_item_id,
          from_user_id,
          to_user_id,
          transfer_mode,
          unregistered_recipient_name,
          unregistered_recipient_role,
          unregistered_location,
          status,
          verification_status,
          notes,
          created_at,
          expires_at,
          resolved_at,
          found_reports (
            id,
            item_name,
            category,
            found_location
          )
        `)
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    return {
      incoming: (inRes.data || []).map(t => ({
        ...t,
        item_name: t.found_reports?.item_name || `Item #${t.found_item_id}`,
        category: t.found_reports?.category || 'General',
      })),
      outgoing: (outRes.data || []).map(t => ({
        ...t,
        item_name: t.found_reports?.item_name || `Item #${t.found_item_id}`,
        category: t.found_reports?.category || 'General',
      })),
      inError: inRes.error?.message || null,
      outError: outRes.error?.message || null,
    }
  } catch (err) {
    console.warn('Error fetching custody transfers:', err)
    return { incoming: [], outgoing: [], inError: err.message, outError: err.message }
  }
}

/**
 * Fetch the complete chronological custody history timeline for a found item
 * Authorized for finder, current custodian, or previous registered custodians
 */
export async function fetchItemCustodyHistory(foundItemId) {
  if (!foundItemId) return { history: [], error: 'Missing found item ID.' }

  const cleanItemId = String(foundItemId).trim()

  // 1. Try secure authorized RPC get_item_custody_history
  try {
    const { data, error } = await supabase.rpc('get_item_custody_history', {
      p_found_item_id: cleanItemId,
    })

    if (!error && Array.isArray(data)) {
      return { history: data, error: null }
    }

    if (error && error.message?.includes('Access denied')) {
      return { history: [], error: error.message }
    }
  } catch (rpcErr) {
    console.warn('get_item_custody_history RPC notice:', rpcErr.message)
  }

  // 2. Direct query fallback on custody_history (protected by enhanced RLS policy)
  try {
    const { data, error } = await supabase
      .from('custody_history')
      .select(`
        id,
        found_item_id,
        actor_id,
        recipient_type,
        recipient_user_id,
        unregistered_recipient_name,
        unregistered_recipient_role,
        unregistered_location,
        custody_status,
        notes,
        created_at
      `)
      .eq('found_item_id', cleanItemId)
      .order('created_at', { ascending: true })

    if (error) {
      return { history: [], error: error.message }
    }

    const normalized = (data || []).map((h) => ({
      history_id: h.id,
      found_item_id: h.found_item_id,
      actor_id: h.actor_id,
      actor_name: 'Campus Member',
      recipient_type: h.recipient_type,
      recipient_user_id: h.recipient_user_id,
      recipient_name: h.recipient_type === 'UNREGISTERED'
        ? (h.unregistered_recipient_name || 'Campus Staff')
        : 'Campus Member',
      recipient_role: h.unregistered_recipient_role || (h.recipient_type === 'UNREGISTERED' ? 'STAFF' : 'MEMBER'),
      location: h.unregistered_location || '',
      custody_status: h.custody_status,
      notes: h.notes,
      created_at: h.created_at,
    }))

    return { history: normalized, error: null }
  } catch (err) {
    return { history: [], error: err.message }
  }
}
