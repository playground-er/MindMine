import { useEffect, useRef } from 'react'
import * as Y from 'yjs'

import { toBytea } from '../lib/bytea'
import { useTransport } from '../lib/transportContext'
import { REMOTE_ORIGIN } from '../lib/yOrigins'
import type { Card } from '../types/db'

/** Text is flushed this long after the document goes quiet. PRD section 6. */
const IDLE_FLUSH_MS = 2000

/**
 * Shared plumbing for every Yjs-backed card: forward local edits over the
 * board transport, and flush the settled document to Postgres.
 *
 * Flush triggers only on local origins — remote edits are already durable
 * wherever they came from, and reacting to them would have every open tab
 * racing to write the same row. `beforeunload` forces a last flush so closing
 * a tab mid-idle-window cannot drop the final keystrokes.
 */
export function useDocFlush(
  doc: Y.Doc,
  cardId: string,
  buildContent: () => Card['content'],
  onDocSettled: (id: string, content: Card['content'], ydocHex: string) => void,
): void {
  const transport = useTransport()

  useEffect(() => {
    if (!transport) return
    transport.track(cardId, doc)
    return () => transport.untrack(cardId, doc)
  }, [transport, cardId, doc])

  const buildRef = useRef(buildContent)
  buildRef.current = buildContent

  const settleRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(settleRef.current)
      onDocSettled(cardId, buildRef.current(), toBytea(Y.encodeStateAsUpdate(doc)))
    }

    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return
      window.clearTimeout(settleRef.current)
      settleRef.current = window.setTimeout(flush, IDLE_FLUSH_MS)
    }

    doc.on('update', onUpdate)
    window.addEventListener('beforeunload', flush)

    return () => {
      doc.off('update', onUpdate)
      window.removeEventListener('beforeunload', flush)
      window.clearTimeout(settleRef.current)
    }
  }, [doc, cardId, onDocSettled])
}
