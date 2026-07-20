import type { RealtimeChannel } from '@supabase/supabase-js'
import * as Y from 'yjs'

import { decodeBase64, encodeBase64 } from './base64'
import { getSupabase } from './supabase'
import { REMOTE_ORIGIN } from './yOrigins'
import { forEachCardDoc, peekCardDoc } from './ydocRegistry'

export { REMOTE_ORIGIN }

interface UpdatePayload {
  cardId: string
  update: string
}

interface SyncRequestPayload {
  cardId: string
}

/**
 * Carries Yjs updates between tabs over one Supabase broadcast channel per
 * board.
 *
 * Broadcast, not `postgres_changes`: text has to land in tens of milliseconds
 * to feel shared, and routing every keystroke through Postgres would mean a
 * write per character. The database sees this document only when it settles —
 * see flushCardDoc in BoardView.
 */
export class YDocTransport {
  private channel: RealtimeChannel
  private observers = new Map<string, (update: Uint8Array, origin: unknown) => void>()

  constructor(boardId: string) {
    this.channel = getSupabase().channel(`ydoc:${boardId}`, {
      config: { broadcast: { self: false } },
    })

    this.channel.on('broadcast', { event: 'update' }, ({ payload }) => {
      const { cardId, update } = payload as UpdatePayload
      const doc = peekCardDoc(cardId)
      if (!doc) return
      Y.applyUpdate(doc, decodeBase64(update), REMOTE_ORIGIN)
    })

    /**
     * A tab that joins late has the database copy, which stops at the last
     * flush. Anything typed inside the current idle window lives only in the
     * other tabs, so they answer with their full state and Yjs merges it.
     */
    this.channel.on('broadcast', { event: 'sync-request' }, ({ payload }) => {
      const { cardId } = payload as SyncRequestPayload
      const doc = peekCardDoc(cardId)
      if (!doc) return
      void this.channel.send({
        type: 'broadcast',
        event: 'update',
        payload: { cardId, update: encodeBase64(Y.encodeStateAsUpdate(doc)) },
      })
    })

    this.channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      // Ask for anything newer than what the database handed us.
      forEachCardDoc((cardId) => this.requestSync(cardId))
    })
  }

  /** Starts forwarding local edits on this card. Safe to call more than once. */
  track(cardId: string, doc: Y.Doc): void {
    if (this.observers.has(cardId)) return

    const observer = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return
      void this.channel.send({
        type: 'broadcast',
        event: 'update',
        payload: { cardId, update: encodeBase64(update) },
      })
    }

    doc.on('update', observer)
    this.observers.set(cardId, observer)
    this.requestSync(cardId)
  }

  untrack(cardId: string, doc: Y.Doc): void {
    const observer = this.observers.get(cardId)
    if (!observer) return
    doc.off('update', observer)
    this.observers.delete(cardId)
  }

  requestSync(cardId: string): void {
    void this.channel.send({
      type: 'broadcast',
      event: 'sync-request',
      payload: { cardId },
    })
  }

  destroy(): void {
    for (const [cardId, observer] of this.observers) {
      peekCardDoc(cardId)?.off('update', observer)
    }
    this.observers.clear()
    void getSupabase().removeChannel(this.channel)
  }
}
