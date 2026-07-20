import { FileText } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { useCardDrag } from '../hooks/useCardDrag'
import { relativeTime } from '../lib/time'
import { useBoardStore } from '../store/boardStore'
import { cardText, type Card } from '../types/db'
import { Icon } from './Icon'

interface Props {
  card: Card
  authorName: string
  isSelected: boolean
  isEditing: boolean
  /** Take the card id so the parent can pass one stable function for all cards. */
  onCommitGeometry: (id: string, next: { x: number; y: number; w: number }) => void
  onCommitText: (id: string, text: string) => void
}

/** Text is flushed this long after the last keystroke. PRD section 6. */
const IDLE_FLUSH_MS = 2000

function NoteCardImpl({
  card,
  authorName,
  isSelected,
  isEditing,
  onCommitGeometry,
  onCommitText,
}: Props) {
  const elementRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(() => cardText(card))
  const flushRef = useRef<number | undefined>(undefined)

  const isDragging = useBoardStore((s) => s.draggingId === card.id)
  const select = useBoardStore((s) => s.select)
  const beginEdit = useBoardStore((s) => s.beginEdit)
  const endEdit = useBoardStore((s) => s.endEdit)

  const commitGeometry = useCallback(
    (next: { x: number; y: number; w: number }) => onCommitGeometry(card.id, next),
    [onCommitGeometry, card.id],
  )

  const { onMovePointerDown, onResizePointerDown } = useCardDrag({
    cardId: card.id,
    elementRef,
    geometry: { x: card.x, y: card.y, w: card.w },
    onCommit: commitGeometry,
  })

  // Remote edits should win while this card is not the one being typed in.
  useEffect(() => {
    if (!isEditing) setDraft(cardText(card))
  }, [card, isEditing])

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  /**
   * Debounced flush. The unmount path also flushes: closing a tab mid-debounce
   * would otherwise silently drop the last thing typed.
   */
  const queueFlush = (text: string) => {
    window.clearTimeout(flushRef.current)
    flushRef.current = window.setTimeout(() => onCommitText(card.id, text), IDLE_FLUSH_MS)
  }

  const flushNow = () => {
    window.clearTimeout(flushRef.current)
    if (draft !== cardText(card)) onCommitText(card.id, draft)
  }

  useEffect(() => {
    return () => window.clearTimeout(flushRef.current)
  }, [])

  const text = isEditing ? draft : cardText(card)
  const [firstLine = '', ...rest] = text.split('\n')
  const body = rest.join('\n').trim()

  const ring = isSelected || isEditing ? 'ring-[1.5px] ring-[var(--accent-note-line)]' : ''
  const shadow = isDragging ? 'shadow-drag' : isSelected || isEditing ? 'shadow-hover' : 'shadow-card'

  return (
    <div
      ref={elementRef}
      role="article"
      aria-label={firstLine || 'Catatan kosong'}
      tabIndex={0}
      style={{
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        width: card.w,
        opacity: isDragging ? 0.94 : 1,
      }}
      className={`absolute left-0 top-0 flex overflow-hidden rounded-md bg-surface ${shadow} ${ring} transition-shadow duration-[120ms] hover:bg-surface-hover hover:shadow-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
      onPointerDown={(e) => {
        select(card.id)
        if (!isEditing) onMovePointerDown(e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        beginEdit(card.id)
      }}
    >
      {/* Accent strip: 2px, full height, square on the left edge. */}
      <div aria-hidden="true" className="w-[2px] shrink-0 bg-[var(--accent-note-ink)]" />

      <div className="min-w-0 flex-1 px-[18px] py-4">
        <div className="flex items-center gap-2">
          <Icon icon={FileText} size={18} className="shrink-0 text-[var(--accent-note-ink)]" />
          {isEditing ? (
            <span className="text-title-card text-ink-tertiary">Catatan</span>
          ) : (
            <span className="truncate text-title-card text-ink">
              {firstLine || <span className="text-ink-tertiary">Catatan kosong</span>}
            </span>
          )}
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              queueFlush(e.target.value)
            }}
            onBlur={() => {
              flushNow()
              endEdit()
            }}
            onKeyDown={(e) => {
              e.stopPropagation() // ⌫ must delete characters, not the card
              if (e.key === 'Escape') {
                flushNow()
                endEdit()
              }
            }}
            rows={4}
            className="mt-3 w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
            placeholder="Tulis sesuatu…"
          />
        ) : (
          body && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{body}</p>
        )}

        <p className="mt-[14px] text-2xs text-ink-tertiary">
          {relativeTime(card.updated_at)} · {authorName}
        </p>
      </div>

      {/* Width-only resize handle; note height follows its content. */}
      <div
        role="separator"
        aria-label="Ubah lebar kartu"
        onPointerDown={onResizePointerDown}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
      />
    </div>
  )
}

/**
 * Compared field by field rather than by object identity: a refetch returns new
 * object references for rows that did not change, and every card would re-render.
 */
export const NoteCard = memo(NoteCardImpl, (a, b) => {
  return (
    a.card.id === b.card.id &&
    a.card.x === b.card.x &&
    a.card.y === b.card.y &&
    a.card.w === b.card.w &&
    a.card.updated_at === b.card.updated_at &&
    cardText(a.card) === cardText(b.card) &&
    a.authorName === b.authorName &&
    a.isSelected === b.isSelected &&
    a.isEditing === b.isEditing &&
    a.onCommitGeometry === b.onCommitGeometry &&
    a.onCommitText === b.onCommitText
  )
})
