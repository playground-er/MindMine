import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { useCardDrag } from '../hooks/useCardDrag'
import type { Accent } from '../lib/accents'
import { relativeTime } from '../lib/time'
import { useBoardStore } from '../store/boardStore'
import type { Card, Member } from '../types/db'
import { AvatarStack } from './AvatarStack'
import { Icon } from './Icon'

export interface CardShellProps {
  card: Card
  accent: Accent
  icon: LucideIcon
  /** Header content to the right of the icon. */
  title: ReactNode
  ariaLabel: string
  authorName: string
  isSelected: boolean
  isEditing: boolean
  isCompact: boolean
  peerEditors: Member[]
  /** Width-resize handle. Off for cards whose width is meaningless (image). */
  resizable?: boolean
  onCommitGeometry: (id: string, next: { x: number; y: number; w: number }) => void
  /** Body, hidden in compact mode. */
  children?: ReactNode
}

/**
 * Elements that own their own pointer interactions. A pointerdown that lands
 * on one of these must not start a card drag — selecting text in a todo item
 * would move the whole card — and a double-click there must not yank focus to
 * the card title.
 */
const INTERACTIVE_SELECTOR = 'input, textarea, button, a, [contenteditable="true"]'

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

/**
 * The card frame every type shares: position, drag, width-resize, accent
 * strip, header, meta line, selection ring, peer-editor indicator, compact
 * mode. Type components supply only the header title and the body.
 */
export function CardShell({
  card,
  accent,
  icon,
  title,
  ariaLabel,
  authorName,
  isSelected,
  isEditing,
  isCompact,
  peerEditors,
  resizable = true,
  onCommitGeometry,
  children,
}: CardShellProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  const isDragging = useBoardStore((s) => s.draggingId === card.id)
  const select = useBoardStore((s) => s.select)
  const beginEdit = useBoardStore((s) => s.beginEdit)

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

  // The transform is also written by useCardDrag during a gesture; React only
  // re-applies it here when the committed geometry actually changes.
  useEffect(() => {
    const el = elementRef.current
    if (el) el.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`
  }, [card.x, card.y])

  const hasPeerEditors = peerEditors.length > 0

  /**
   * Ring and elevation live in ONE inline box-shadow. Splitting them — ring
   * inline, elevation as a Tailwind class — silently drops the elevation,
   * because inline style beats the class. Selecting on pointerdown then made
   * every drag lose its shadow.
   */
  const [isHovered, setIsHovered] = useState(false)
  const elevation = isDragging
    ? 'var(--shadow-drag)'
    : isSelected || isEditing || isHovered
      ? 'var(--shadow-hover)'
      : 'var(--shadow-card)'
  const ring = isSelected || isEditing ? `0 0 0 1.5px ${accent.line}, ` : ''

  return (
    <div
      ref={elementRef}
      role="article"
      aria-label={ariaLabel}
      tabIndex={0}
      // Keeps the viewport's native pan handler off this subtree — see
      // NO_PAN_SELECTOR in useCanvasGestures.
      data-no-pan=""
      style={{
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        width: card.w,
        opacity: isDragging ? 0.94 : 1,
        boxShadow: `${ring}${elevation}`,
        // Dashed, and only an outline — nobody is ever blocked from a card.
        outline: hasPeerEditors ? `1.5px dashed ${accent.line}` : undefined,
        outlineOffset: hasPeerEditors ? '2px' : undefined,
      }}
      className="absolute left-0 top-0 flex rounded-md bg-surface transition-shadow duration-[120ms] hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={(e) => {
        // Unconditional: the canvas deselects on any pointerdown that reaches
        // it, so letting this through while editing would close the editor the
        // moment you clicked inside your own textarea.
        e.stopPropagation()
        select(card.id)
        // Interactive children (todo inputs, checkboxes, links) own their
        // pointer — starting a drag from them turns text selection into
        // card movement.
        if (!isEditing && !isInteractive(e.target)) onMovePointerDown(e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!isInteractive(e.target)) beginEdit(card.id)
      }}
    >
      {/* Accent strip: 2px, full height, square on the left edge. */}
      <div
        aria-hidden="true"
        className="w-[2px] shrink-0"
        style={{ background: accent.ink, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }}
      />

      <div className="min-w-0 flex-1 px-[18px] py-4">
        <div className="flex items-center gap-2">
          <Icon icon={icon} size={18} className="shrink-0" style={{ color: accent.ink }} />
          {title}
        </div>

        {!isCompact && children}

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

      {resizable && (
        <div
          role="separator"
          aria-label="Ubah lebar kartu"
          onPointerDown={onResizePointerDown}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
        />
      )}
    </div>
  )
}

/**
 * Shared memo comparator for card components. Field-by-field because a refetch
 * returns new object references for unchanged rows. Content is compared by
 * reference: cache patches and realtime rows always produce a new object.
 */
export function cardPropsEqual(
  a: { card: Card } & Record<string, unknown>,
  b: { card: Card } & Record<string, unknown>,
): boolean {
  return (
    a.card.id === b.card.id &&
    a.card.x === b.card.x &&
    a.card.y === b.card.y &&
    a.card.w === b.card.w &&
    a.card.updated_at === b.card.updated_at &&
    a.card.content === b.card.content &&
    a.authorName === b.authorName &&
    a.isSelected === b.isSelected &&
    a.isEditing === b.isEditing &&
    a.isCompact === b.isCompact &&
    a.peerEditors === b.peerEditors &&
    a.onCommitGeometry === b.onCommitGeometry &&
    a.onDocSettled === b.onDocSettled &&
    a.onContentChange === b.onContentChange
  )
}
