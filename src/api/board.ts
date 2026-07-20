import { getSupabase } from '../lib/supabase'
import type { Board } from '../types/db'

/**
 * The root board is the one with no parent card. Created on first open.
 *
 * Two people opening an empty instance at the same moment can both insert a
 * root. Rather than lock, we always take the oldest — the loser's board is
 * empty and harmless, and it can be re-linked later from ⌘K. A unique
 * constraint here would mean a failed insert on a cold start, which is worse.
 */
export async function fetchOrCreateRootBoard(memberId: string): Promise<Board> {
  const sb = getSupabase()

  const { data: existing, error: selectError } = await sb
    .from('board')
    .select('*')
    .is('parent_card_id', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (selectError) throw selectError
  if (existing && existing.length > 0) return existing[0] as Board

  const { data: created, error: insertError } = await sb
    .from('board')
    .insert({ title: 'MindMine', created_by: memberId })
    .select()
    .single()

  if (insertError) throw insertError
  return created as Board
}
