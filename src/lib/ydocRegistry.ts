import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'

import type { TodoItem } from '../types/db'
import { itemsOf, seedItems } from './todoItems'
import { LOCAL_ORIGIN } from './yOrigins'

export { LOCAL_ORIGIN }

/** Plain values used to fill a brand-new doc from the jsonb copy. */
export interface DocSeed {
  text?: string
  items?: TodoItem[]
}

export interface CardDoc {
  doc: Y.Doc
  text: Y.Text
  undoManager: Y.UndoManager
  /** Resolves once IndexedDB has replayed whatever was stored offline. */
  whenSynced: Promise<void>
  release: () => void
}

interface Entry extends CardDoc {
  refCount: number
  persistence: IndexeddbPersistence
}

const registry = new Map<string, Entry>()

export const TEXT_KEY = 'body'

/**
 * One Y.Doc per card, reference counted.
 *
 * Cards mount and unmount constantly once viewport culling lands in Tahap 4,
 * and rebuilding a doc on every scroll would drop the undo history and force
 * an IndexedDB round trip each time. Ref counting keeps the doc alive for as
 * long as anything still points at it.
 */
export function acquireCardDoc(cardId: string, seed: DocSeed, seedState: Uint8Array | null): CardDoc {
  const existing = registry.get(cardId)
  if (existing) {
    existing.refCount++
    return existing
  }

  const doc = new Y.Doc()

  // Server state first: it is the shared history. Applying it before IndexedDB
  // means the local replay merges into it rather than racing it.
  if (seedState) {
    try {
      Y.applyUpdate(doc, seedState, 'seed')
    } catch {
      // A corrupt blob must not take the card down — fall through to seedText.
    }
  }

  const text = doc.getText(TEXT_KEY)

  const persistence = new IndexeddbPersistence(`mindmine-card-${cardId}`, doc)

  const whenSynced = new Promise<void>((resolve) => {
    persistence.once('synced', () => {
      /**
       * Cards can predate their ydoc — written before Tahap 3, or created
       * fresh with only jsonb content. Seed from the plain copy once, and only
       * when the doc is genuinely empty — doing it unconditionally would
       * duplicate the body on every open.
       */
      if (seed.text && text.length === 0) {
        doc.transact(() => text.insert(0, seed.text!), LOCAL_ORIGIN)
      }
      if (seed.items && seed.items.length > 0 && itemsOf(doc).length === 0) {
        seedItems(doc, seed.items)
      }
      resolve()
    })
  })

  // Tracking both roots keeps one ⌘Z history per card: a text edit and an
  // item toggle undo in the order they happened, not per structure.
  const undoManager = new Y.UndoManager([text, itemsOf(doc)], {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 400,
  })

  const entry: Entry = {
    doc,
    text,
    undoManager,
    whenSynced,
    persistence,
    refCount: 1,
    release: () => releaseCardDoc(cardId),
  }

  registry.set(cardId, entry)
  return entry
}

function releaseCardDoc(cardId: string): void {
  const entry = registry.get(cardId)
  if (!entry) return

  entry.refCount--
  if (entry.refCount > 0) return

  entry.undoManager.destroy()
  void entry.persistence.destroy()
  entry.doc.destroy()
  registry.delete(cardId)
}

/** Live docs, so the transport can route an incoming update without a lookup miss. */
export function peekCardDoc(cardId: string): Y.Doc | undefined {
  return registry.get(cardId)?.doc
}

export function forEachCardDoc(fn: (cardId: string, doc: Y.Doc) => void): void {
  for (const [cardId, entry] of registry) fn(cardId, entry.doc)
}
