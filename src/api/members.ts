import { getSupabase } from '../lib/supabase'
import type { Member } from '../types/db'

/**
 * The whole team, fetched once. The ceiling is 20 people by design (PRD
 * section 3), so a lookup table beats a join on every card.
 */
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await getSupabase().from('member').select('*')
  if (error) throw error
  return (data ?? []) as Member[]
}
