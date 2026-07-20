import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as Y from 'yjs'

import { applyStringDiff } from '../lib/textDiff'
import { acquireCardDoc, LOCAL_ORIGIN, type CardDoc } from '../lib/ydocRegistry'

interface Result {
  value: string
  setValue: (next: string) => void
  undoManager: CardDoc['undoManager']
  doc: CardDoc['doc']
}

/**
 * Binds a card's Y.Text to a controlled textarea.
 *
 * The caret is tracked as a Yjs relative position across remote updates.
 * Restoring a plain integer offset would drift every time somebody else
 * inserted text earlier in the document, which reads as the cursor jumping on
 * its own while you type.
 */
export function useYText(
  cardId: string,
  seedText: string,
  seedState: Uint8Array | null,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
): Result {
  // Seeds are only consulted when the doc is first created, so a changing
  // `seedText` from a refetch must not rebuild it.
  const seedRef = useRef({ seedText, seedState })
  const cardDoc = useMemo(
    () => acquireCardDoc(cardId, seedRef.current.seedText, seedRef.current.seedState),
    [cardId],
  )

  const [value, setLocalValue] = useState(() => cardDoc.text.toString())

  useEffect(() => {
    const { text, doc } = cardDoc

    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      const el = textareaRef.current
      const isRemote = transaction.origin !== LOCAL_ORIGIN
      const active = el && document.activeElement === el

      if (!isRemote || !active) {
        setLocalValue(text.toString())
        return
      }

      const relStart = Y.createRelativePositionFromTypeIndex(text, el.selectionStart)
      const relEnd = Y.createRelativePositionFromTypeIndex(text, el.selectionEnd)

      setLocalValue(text.toString())

      queueMicrotask(() => {
        const absStart = Y.createAbsolutePositionFromRelativePosition(relStart, doc)
        const absEnd = Y.createAbsolutePositionFromRelativePosition(relEnd, doc)
        if (absStart && absEnd) el.setSelectionRange(absStart.index, absEnd.index)
      })

      void event
    }

    text.observe(observer)
    void cardDoc.whenSynced.then(() => setLocalValue(text.toString()))

    return () => {
      text.unobserve(observer)
      cardDoc.release()
    }
  }, [cardDoc, textareaRef])

  const setValue = useCallback(
    (next: string) => {
      setLocalValue(next)
      applyStringDiff(cardDoc.text, next)
    },
    [cardDoc],
  )

  return { value, setValue, undoManager: cardDoc.undoManager, doc: cardDoc.doc }
}
