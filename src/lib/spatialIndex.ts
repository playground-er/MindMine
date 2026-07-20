import type { Card } from '../types/db'

/**
 * Bucket edge in world units. Large enough that a screen spans only a handful
 * of buckets, small enough that a bucket is not most of the board.
 */
const CELL = 512

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Notes have no stored height until they render; assume a typical one. */
const ASSUMED_H = 160

function cardRect(card: Card): Rect {
  return { x: card.x, y: card.y, w: card.w, h: card.h ?? ASSUMED_H }
}

const keyOf = (cx: number, cy: number) => `${cx}:${cy}`

/**
 * Uniform grid index over card positions.
 *
 * PROMPTS Tahap 4 asks for buckets rather than scanning the array every frame:
 * at 300 cards a full scan per pan frame is 300 intersection tests sixty times
 * a second, and it grows linearly while the visible set does not.
 */
export class SpatialIndex {
  private buckets = new Map<string, Card[]>()

  constructor(cards: Card[]) {
    for (const card of cards) this.insert(card)
  }

  private insert(card: Card): void {
    const r = cardRect(card)
    const x0 = Math.floor(r.x / CELL)
    const y0 = Math.floor(r.y / CELL)
    const x1 = Math.floor((r.x + r.w) / CELL)
    const y1 = Math.floor((r.y + r.h) / CELL)

    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = keyOf(cx, cy)
        const bucket = this.buckets.get(key)
        if (bucket) bucket.push(card)
        else this.buckets.set(key, [card])
      }
    }
  }

  /** Ids of cards overlapping `view`. A card spanning buckets is returned once. */
  query(view: Rect): Set<string> {
    const found = new Set<string>()

    const x0 = Math.floor(view.x / CELL)
    const y0 = Math.floor(view.y / CELL)
    const x1 = Math.floor((view.x + view.w) / CELL)
    const y1 = Math.floor((view.y + view.h) / CELL)

    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = this.buckets.get(keyOf(cx, cy))
        if (!bucket) continue

        for (const card of bucket) {
          if (found.has(card.id)) continue
          const r = cardRect(card)
          const overlaps =
            r.x < view.x + view.w &&
            r.x + r.w > view.x &&
            r.y < view.y + view.h &&
            r.y + r.h > view.y
          if (overlaps) found.add(card.id)
        }
      }
    }

    return found
  }
}

export function sameIdSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}
