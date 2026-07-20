/** Mirrors supabase/migrations/0001_init.sql. Keep the two in step. */

export type CardType = 'note' | 'todo' | 'image' | 'link' | 'board'

export interface Member {
  id: string
  email: string
  name: string
  avatar_url: string | null
  created_at: string
}

export interface Board {
  id: string
  parent_card_id: string | null
  title: string
  created_by: string
  created_at: string
  updated_at: string
}

/** `{ text }` for note. Other types arrive in Tahap 5. */
export interface NoteContent {
  text: string
}

export interface Card {
  id: string
  board_id: string
  type: CardType
  x: number
  y: number
  w: number
  /** null means auto height — note cards grow with their content. */
  h: number | null
  z: number
  content: NoteContent | Record<string, unknown>
  accent: string | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function isNoteContent(content: Card['content']): content is NoteContent {
  return typeof (content as NoteContent).text === 'string'
}

/** Cards carry plain text in `content` even once Yjs owns editing (Tahap 3). */
export function cardText(card: Card): string {
  return isNoteContent(card.content) ? card.content.text : ''
}
