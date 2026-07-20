import type { CardType } from '../types/db'

export interface Accent {
  ink: string
  line: string
  tint: string
}

/**
 * Accent per card type, as full literal var() strings.
 *
 * Interpolating the type name into a Tailwind arbitrary-value class silently
 * produces nothing — Tailwind only generates classes it can see verbatim at
 * build time. So these are applied through inline style instead. (And do not
 * spell such a class out even in a comment: the scanner reads comments too,
 * picks up the candidate, and emits broken CSS. That happened here.)
 */
export const ACCENTS: Record<CardType, Accent> = {
  note: {
    ink: 'var(--accent-note-ink)',
    line: 'var(--accent-note-line)',
    tint: 'var(--accent-note-tint)',
  },
  todo: {
    ink: 'var(--accent-todo-ink)',
    line: 'var(--accent-todo-line)',
    tint: 'var(--accent-todo-tint)',
  },
  image: {
    ink: 'var(--accent-image-ink)',
    line: 'var(--accent-image-line)',
    tint: 'var(--accent-image-tint)',
  },
  link: {
    ink: 'var(--accent-link-ink)',
    line: 'var(--accent-link-line)',
    tint: 'var(--accent-link-tint)',
  },
  board: {
    ink: 'var(--accent-board-ink)',
    line: 'var(--accent-board-line)',
    tint: 'var(--accent-board-tint)',
  },
}
