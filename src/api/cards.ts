import { getSupabase } from '../lib/supabase'
import type { Card } from '../types/db'

/** Live cards for a board. Soft-deleted rows are filtered out, not purged. */
export async function listCards(boardId: string): Promise<Card[]> {
  const { data, error } = await getSupabase()
    .from('card')
    .select('*')
    .eq('board_id', boardId)
    .is('deleted_at', null)
    .order('z', { ascending: true })

  if (error) throw error
  return (data ?? []) as Card[]
}

export interface CreateNoteInput {
  boardId: string
  memberId: string
  x: number
  y: number
  z: number
}

export async function createNoteCard(input: CreateNoteInput): Promise<Card> {
  const { data, error } = await getSupabase()
    .from('card')
    .insert({
      board_id: input.boardId,
      type: 'note',
      x: input.x,
      y: input.y,
      z: input.z,
      content: { text: '' },
      created_by: input.memberId,
      updated_by: input.memberId,
    })
    .select()
    .single()

  if (error) throw error
  return data as Card
}

/**
 * Written once, when the pointer is released — not during the drag. Position
 * during a drag lives on the element's transform; see useCardDrag.
 */
export async function updateCardGeometry(
  id: string,
  geometry: { x: number; y: number; w?: number },
  memberId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('card')
    .update({ ...geometry, updated_by: memberId })
    .eq('id', id)

  if (error) throw error
}

export async function updateCardText(id: string, text: string, memberId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('card')
    .update({ content: { text }, updated_by: memberId })
    .eq('id', id)

  if (error) throw error
}

/**
 * Flushes a settled Yjs document.
 *
 * Both columns are written together on purpose: `ydoc` is the authoritative
 * CRDT state, `content.text` is the plain copy that search and list view read.
 * PRD section 5 calls the duplication deliberate — searching inside CRDT binary
 * is expensive, and list view never needs character-level resolution.
 */
export async function flushCardDoc(
  id: string,
  ydocHex: string,
  text: string,
  memberId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('card')
    .update({ ydoc: ydocHex, content: { text }, updated_by: memberId })
    .eq('id', id)

  if (error) throw error
}

/** Soft delete — the row stays for 30 days so the mistake stays recoverable. */
export async function softDeleteCard(id: string, memberId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('card')
    .update({ deleted_at: new Date().toISOString(), updated_by: memberId })
    .eq('id', id)

  if (error) throw error
}

export async function restoreCard(id: string, memberId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('card')
    .update({ deleted_at: null, updated_by: memberId })
    .eq('id', id)

  if (error) throw error
}
