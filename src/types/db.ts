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

/** `{ text }` for note. */
export interface NoteContent {
  text: string
}

export interface TodoItem {
  id: string
  text: string
  done: boolean
}

/**
 * `title` is an extension over the PRD shape (`{ items }` only) — the card
 * header needs something to show, and deriving it from the first item makes
 * checking that item off rename the card.
 */
export interface TodoContent {
  title: string
  items: TodoItem[]
}

/** `url` holds a storage path, not a public URL — the bucket is private. */
export interface ImageContent {
  url: string
  alt: string
  natural_w: number
  natural_h: number
}

export interface LinkContent {
  url: string
  title?: string
  favicon?: string
  og_image?: string
}

/**
 * The open Record arm covers rows written by other (possibly newer) clients —
 * jsonb enforces nothing, so the guards below are the only gate.
 */
export type CardContent =
  | NoteContent
  | TodoContent
  | ImageContent
  | LinkContent
  | Record<string, unknown>

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
  content: CardContent
  /** Yjs state, arriving from PostgREST as a `\x…` hex string. Null before Tahap 3. */
  ydoc: string | null
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

export function isTodoContent(content: Card['content']): content is TodoContent {
  return Array.isArray((content as TodoContent).items)
}

export function isImageContent(content: Card['content']): content is ImageContent {
  const c = content as ImageContent
  return typeof c.url === 'string' && typeof c.natural_w === 'number' && typeof c.natural_h === 'number'
}

export function isLinkContent(content: Card['content']): content is LinkContent {
  // Distinguished from image by the absence of dimensions.
  const c = content as ImageContent
  return typeof c.url === 'string' && typeof c.natural_w !== 'number'
}

/** Cards carry plain text in `content` even once Yjs owns editing (Tahap 3). */
export function cardText(card: Card): string {
  return isNoteContent(card.content) ? card.content.text : ''
}
