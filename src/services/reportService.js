import { supabase } from '../supabase.js'

/**
 * Fetch public feed reports from restricted public catalog views
 * Falls back to safe public column selection if views are pending migration
 */
export async function fetchPublicFeed() {
  const errors = []
  let lostItems = []
  let foundItems = []

  // 1. Fetch Lost Reports from public catalog view
  try {
    const { data, error } = await supabase
      .from('lost_items_public_catalog')
      .select('id, item_name, category, description, lost_location, lost_date, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // Safe fallback for pre-migration state: reads only non-sensitive public columns
      const fallback = await supabase
        .from('lost_reports')
        .select('id, item_name, category, description, lost_location, lost_date, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (fallback.error) {
        errors.push(`Lost reports: ${error.message}`)
      } else {
        lostItems = (fallback.data || []).map(item => ({ ...item, id: String(item.id) }))
      }
    } else {
      lostItems = (data || []).map(item => ({ ...item, id: String(item.id) }))
    }
  } catch (err) {
    errors.push(`Lost reports network error: ${err.message}`)
  }

  // 2. Fetch Found Reports from public catalog view
  try {
    const { data, error } = await supabase
      .from('found_items_public_catalog')
      .select('id, item_name, category, description, found_location, found_date, status, is_unregistered_custodian, unregistered_custodian_name, unregistered_custodian_role, unregistered_custodian_location, finder_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // Safe fallback for pre-migration state: reads only non-sensitive public columns
      const fallback = await supabase
        .from('found_reports')
        .select('id, item_name, category, description, found_location, found_date, status, is_unregistered_custodian, unregistered_custodian_name, unregistered_custodian_role, unregistered_custodian_location, finder_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (fallback.error) {
        errors.push(`Found reports: ${error.message}`)
      } else {
        foundItems = (fallback.data || []).map(item => ({ ...item, id: String(item.id) }))
      }
    } else {
      foundItems = (data || []).map(item => ({ ...item, id: String(item.id) }))
    }
  } catch (err) {
    errors.push(`Found reports network error: ${err.message}`)
  }

  return {
    lostItems,
    foundItems,
    error: errors.length > 0 ? errors.join(' | ') : null,
  }
}

/**
 * Submit Lost Report using authorized RPC
 * Never bypasses RLS via direct INSERT.
 */
export async function submitLostReport(report) {
  if (!report.item_name?.trim() || !report.category || !report.lost_location?.trim() || !report.lost_date) {
    throw new Error('All required lost report fields must be provided.')
  }

  const { data, error } = await supabase.rpc('create_lost_report', {
    p_item_name: report.item_name.trim(),
    p_category: report.category,
    p_description: report.description?.trim() || '',
    p_lost_location: report.lost_location.trim(),
    p_lost_date: String(report.lost_date),
  })

  if (error) throw error
  return { success: true, reportId: String(data) }
}

/**
 * Submit Found Report using authorized RPC (with private verification clues)
 * Never bypasses RLS via direct INSERT.
 */
export async function submitFoundReport(report) {
  if (!report.item_name?.trim() || !report.category || !report.found_location?.trim() || !report.found_date) {
    throw new Error('All required found report fields must be provided.')
  }

  const { data, error } = await supabase.rpc('create_found_report', {
    p_item_name: report.item_name.trim(),
    p_category: report.category,
    p_description: report.description?.trim() || '',
    p_found_location: report.found_location.trim(),
    p_found_date: report.found_date,
    p_secret_marker: report.secret_marker?.trim() || null,
    p_serial_number_hint: report.serial_number_hint?.trim() || null,
    p_private_notes: report.private_notes?.trim() || null,
  })

  if (error) throw error
  return { success: true, reportId: String(data) }
}

/**
 * Close user's open lost report via authorized RPC
 * Never bypasses RLS via direct client UPDATE.
 */
export async function closeMyLostReport(lostReportId) {
  if (!lostReportId) throw new Error('Missing lost report ID.')
  const cleanId = String(lostReportId).trim()

  const { data, error } = await supabase.rpc('close_my_lost_report', {
    p_lost_report_id: cleanId,
  })

  if (error) throw error
  return { success: true, result: data }
}

/**
 * Fetch reports submitted by the logged-in user
 */
export async function fetchUserReports(userId) {
  if (!userId) return { myLost: [], myFound: [] }

  const [lostRes, foundRes] = await Promise.all([
    supabase
      .from('lost_reports')
      .select('id, item_name, category, description, lost_location, lost_date, status, created_at')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('found_reports')
      .select('id, item_name, category, description, found_location, found_date, status, finder_id, current_custodian_id, is_unregistered_custodian, unregistered_custodian_name, unregistered_custodian_role, unregistered_custodian_location, resolved_at, created_at')
      .or(`finder_id.eq.${userId},current_custodian_id.eq.${userId}`)
      .order('created_at', { ascending: false })
  ])

  return {
    myLost: (lostRes.data || []).map(r => ({ ...r, id: String(r.id) })),
    myFound: (foundRes.data || []).map(r => ({ ...r, id: String(r.id) })),
    lostError: lostRes.error?.message,
    foundError: foundRes.error?.message,
  }
}
