import { FileText } from 'lucide-react'
import { memo, useCallback, useEffect, useRef } from 'react'
import * as Y from 'yjs'

import { useCardDrag } from '../hooks/useCardDrag'
import { useYText } from '../hooks/useYText'
import { fromBytea, toBytea } from '../lib/bytea'
import { relativeTime } from '../lib/time'
import { useTransport } from '../lib/transportContext'
import { TEXT_KEY } from '../lib/ydocRegistry'
import { REMOTE_ORIGIN } from '../lib/ydocTransport'
import { useBoardStore } from '../store/boardStore'
import { cardText, type Card, type Member } from '../types/db'
import { AvatarStack } from './AvatarStack'
import { Icon } from './Icon'

/** Text is flushed this long after the document goes quiet. PRD section 6. */
const IDLE_FLUSH_MS = 2000

interface Props {
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
  onTextSettled: (id: string, text: string, ydocHex: string) => void
}

function NoteCardImpl({
  card,
  authorName,
  isSelected,
  isEditing,
  peerEditors,
  isCompact,
  onCommitGeometry,
  onTextSettled,
}: Props) {
  const elementRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const transport = useTransport()

  const isDragging = useBoardStore((s) => s.draggingId === card.id)
  const select = useBoardStore((s) => s.select)
  const beginEdit = useBoardStore((s) => s.beginEdit)
  const endEdit = useBoardStore((s) => s.endEdit)

  const { value, setValue, undoManager, doc } = useYText(
    card.id,
    cardText(card),
    fromBytea(card.ydoc),
    textareaRef,
  )

  // Local edits go out over broadcast; remote ones arrive the same way.
  useEffect(() => {
    if (!transport) return
    transport.track(card.id, doc)
    return () => transport.untrack(card.id, doc)
  }, [transport, card.id, doc])

  /**
   * Flush to Postgres once the document has been quiet for two seconds
   * (PRD section 6). A tab closing mid-window would otherwise drop whatever
   * was typed inside it, so `beforeunload` forces the last one.
   */
  const settleRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(settleRef.current)
      onTextSettled(card.id, doc.getText(TEXT_KEY).toString(), toBytea(Y.encodeStateAsUpdate(doc)))
    }

    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      // Remote edits are already durable wherever they came from; flushing
      // them again would have every tab racing to write the same row.
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
  }, [doc, card.id, onTextSettled])

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

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  const [firstLine = '', ...rest] = value.split('\n')
  const body = rest.join('\n').trim()

  const hasPeerEditors = peerEditors.length > 0
  const ring = isSelected || isEditing ? 'ring-[1.5px] ring-[var(--accent-note-line)]' : ''
  const shadow = isDragging ? 'shadow-drag' : isSelected || isEditing ? 'shadow-hover' : 'shadow-card'

  return (
    <div
      ref={elementRef}
      role="article"
      aria-label={firstLine || 'Catatan kosong'}
      tabIndex={0}
      // Keeps the viewport's native pan handler off this subtree — see
      // NO_PAN_SELECTOR in useCanvasGestures.
      data-no-pan=""
      style={{
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        width: card.w,
        opacity: isDragging ? 0.94 : 1,
        // Dashed, and only an outline — nobody is ever blocked from a card.
        outline: hasPeerEditors ? '1.5px dashed var(--accent-note-line)' : undefined,
        outlineOffset: hasPeerEditors ? '2px' : undefined,
      }}
      className={`absolute left-0 top-0 flex rounded-md bg-surface ${shadow} ${ring} transition-shadow duration-[120ms] hover:bg-surface-hover hover:shadow-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
      onPointerDown={(e) => {
        // Unconditional: the canvas deselects on any pointerdown that reaches
        // it, so letting this through while editing would close the editor the
        // moment you clicked inside your own textarea.
        e.stopPropagation()
        select(card.id)
        if (!isEditing) onMovePointerDown(e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        beginEdit(card.id)
      }}
    >
      {/* Accent strip: 2px, full height, square on the left edge. */}
      <div
        aria-hidden="true"
        className="w-[2px] shrink-0 rounded-l-md bg-[var(--accent-note-ink)]"
        style={{ borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }}
      />

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

        {isCompact ? null : isEditing ? (
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

        {!isCompact && (
          <p className="mt-[14px] text-2xs text-ink-tertiary">
            {relativeTime(card.updated_at)} · {authorName}
          </p>
        )}
      </div>

      {hasPeerEditors && (
        <div className="absolute right-2 top-2">
          <AvatarStack members={peerEditors} size={16} max={2} />
        </div>
      )}

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
 * Text is absent on purpose — Yjs owns it, and it never arrives through props.
 */
export const NoteCard = memo(NoteCardImpl, (a, b) => {
  return (
    a.card.id === b.card.id &&
    a.card.x === b.card.x &&
    a.card.y === b.card.y &&
    a.card.w === b.card.w &&
    a.card.updated_at === b.card.updated_at &&
    a.authorName === b.authorName &&
    a.isSelected === b.isSelected &&
    a.isEditing === b.isEditing &&
    a.isCompact === b.isCompact &&
    a.peerEditors === b.peerEditors &&
    a.onCommitGeometry === b.onCommitGeometry &&
    a.onTextSettled === b.onTextSettled
  )
})
