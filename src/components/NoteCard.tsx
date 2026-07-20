import { FileText } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'

import { useDocFlush } from '../hooks/useDocFlush'
import { useYText } from '../hooks/useYText'
import { ACCENTS } from '../lib/accents'
import { fromBytea } from '../lib/bytea'
import { TEXT_KEY } from '../lib/ydocRegistry'
import { useBoardStore } from '../store/boardStore'
import { cardText, type Card, type Member } from '../types/db'
import { CardShell, cardPropsEqual } from './CardShell'

export interface CardTypeProps {
  card: Card
  authorName: string
  isSelected: boolean
  isEditing: boolean
  /** Peers with this card open. Drives the dashed ring — never a lock. */
  peerEditors: Member[]
  /**
   * Below 50% zoom cards drop to title only. Passed down as a boolean rather
   * than read from the store per card, so a zoom change re-renders cards once
   * at the threshold instead of on every intermediate value.
   */
  isCompact: boolean
  /** Take the card id so the parent can pass one stable function for all cards. */
  onCommitGeometry: (id: string, next: { x: number; y: number; w: number }) => void
  /** Settled Yjs doc → jsonb + ydoc columns. Note and todo only. */
  onDocSettled: (id: string, content: Card['content'], ydocHex: string) => void
  /** LWW content write for non-Yjs types (image, link). */
  onContentChange: (id: string, content: Card['content']) => void
}

function NoteCardImpl({
  card,
  authorName,
  isSelected,
  isEditing,
  peerEditors,
  isCompact,
  onCommitGeometry,
  onDocSettled,
}: CardTypeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const endEdit = useBoardStore((s) => s.endEdit)

  const { value, setValue, undoManager, doc } = useYText(
    card.id,
    { text: cardText(card) },
    fromBytea(card.ydoc),
    textareaRef,
  )

  useDocFlush(doc, card.id, () => ({ text: doc.getText(TEXT_KEY).toString() }), onDocSettled)

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  const [firstLine = '', ...rest] = value.split('\n')
  const body = rest.join('\n').trim()

  return (
    <CardShell
      card={card}
      accent={ACCENTS.note}
      icon={FileText}
      ariaLabel={firstLine || 'Catatan kosong'}
      authorName={authorName}
      isSelected={isSelected}
      isEditing={isEditing}
      isCompact={isCompact}
      peerEditors={peerEditors}
      onCommitGeometry={onCommitGeometry}
      title={
        isEditing ? (
          <span className="text-title-card text-ink-tertiary">Catatan</span>
        ) : (
          <span className="truncate text-title-card text-ink">
            {firstLine || <span className="text-ink-tertiary">Catatan kosong</span>}
          </span>
        )
      }
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={endEdit}
          onKeyDown={(e) => {
            e.stopPropagation() // ⌫ must delete characters, not the card

            // Per-user undo: the manager only tracks this tab's origin, so
            // this can never roll back someone else's sentence.
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault()
              if (e.shiftKey) undoManager.redo()
              else undoManager.undo()
              return
            }
            if (e.key === 'Escape') endEdit()
          }}
          rows={4}
          className="mt-3 w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
          placeholder="Tulis sesuatu…"
        />
      ) : (
        body && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{body}</p>
      )}
    </CardShell>
  )
}

export const NoteCard = memo(NoteCardImpl, cardPropsEqual)
