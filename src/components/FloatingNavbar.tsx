import {
  CircleCheck,
  FileText,
  Image,
  LayoutGrid,
  Link2,
  Minus,
  MoreHorizontal,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { useZoomTween } from '../hooks/useZoomTween'
import { useCanvasStore, ZOOM_MAX, ZOOM_MIN } from '../store/canvasStore'
import type { CardType } from '../types/db'
import { Icon } from './Icon'

const STEP = 1.25

/** Tools beyond this collapse into the overflow, least-used first. */
const MAX_INLINE = 4

/** Pointer travel below this is a click; beyond it, a drag to the canvas. */
const DRAG_THRESHOLD = 4

interface Tool {
  type: CardType
  label: string
  icon: LucideIcon
  /** Lower stays inline when space runs out. Ordered by expected use. */
  priority: number
  available: boolean
}

const TOOLS: Tool[] = [
  { type: 'note', label: 'Catatan', icon: FileText, priority: 0, available: true },
  { type: 'todo', label: 'Todo', icon: CircleCheck, priority: 1, available: true },
  { type: 'image', label: 'Gambar', icon: Image, priority: 2, available: true },
  { type: 'link', label: 'Tautan', icon: Link2, priority: 3, available: true },
  // Tahap 6.
  { type: 'board', label: 'Board', icon: LayoutGrid, priority: 4, available: false },
]

export interface ToolDrop {
  clientX: number
  clientY: number
}

interface Props {
  /** `at` is the drop point of a drag; null means a plain click (drop mid-view). */
  onCreate: (type: CardType, at: ToolDrop | null) => void
}

interface ToolDrag {
  tool: Tool
  x: number
  y: number
}

export function FloatingNavbar({ onCreate }: Props) {
  const zoom = useCanvasStore((s) => s.viewport.zoom)
  const tweenTo = useZoomTween()
  const [expanded, setExpanded] = useState(false)

  /**
   * Milanote's core affordance: tools are dragged onto the canvas and land
   * where you drop them. A plain click still works and drops mid-viewport.
   * The ghost chip is the drag feedback; Escape cancels.
   */
  const [drag, setDrag] = useState<ToolDrag | null>(null)
  const dragRef = useRef<{ tool: Tool; startX: number; startY: number; moved: boolean } | null>(null)

  const beginToolDrag = (tool: Tool) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = { tool, startX: e.clientX, startY: e.clientY, moved: false }

    const onMove = (ev: PointerEvent) => {
      const s = dragRef.current
      if (!s) return
      if (
        !s.moved &&
        Math.abs(ev.clientX - s.startX) < DRAG_THRESHOLD &&
        Math.abs(ev.clientY - s.startY) < DRAG_THRESHOLD
      ) {
        return
      }
      s.moved = true
      setDrag({ tool: s.tool, x: ev.clientX, y: ev.clientY })
    }

    const finish = (ev: PointerEvent | null) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
      const s = dragRef.current
      dragRef.current = null
      setDrag(null)
      // A drag that started from the overflow menu never fires click, so the
      // menu would stay open behind the new card.
      setExpanded(false)
      if (!s || !ev) return // ev null = cancelled with Escape
      onCreate(s.tool.type, s.moved ? { clientX: ev.clientX, clientY: ev.clientY } : null)
    }

    const onUp = (ev: PointerEvent) => finish(ev)
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
  }

  const usable = TOOLS.filter((t) => t.available).sort((a, b) => a.priority - b.priority)
  const inline = usable.slice(0, MAX_INLINE)
  const overflow = usable.slice(MAX_INLINE)

  const percent = Math.round(zoom * 100)

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2"
      data-no-pan=""
      onPointerDown={(e) => e.stopPropagation()}
    >
      {expanded && overflow.length > 0 && (
        <div className="mb-2 flex flex-col gap-1 rounded-md bg-surface p-1 shadow-float">
          {overflow.map((tool) => (
            <button
              key={tool.type}
              type="button"
              onPointerDown={beginToolDrag(tool)}
              className="flex items-center gap-2 rounded-sm px-2 py-[6px] text-left text-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink"
            >
              <Icon icon={tool.icon} size={16} />
              {tool.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 rounded-md bg-surface p-1 shadow-float">
        {inline.map((tool) => (
          <button
            key={tool.type}
            type="button"
            title={`${tool.label} — klik, atau seret ke kanvas`}
            aria-label={`Buat ${tool.label}. Klik, atau seret ke posisi di kanvas.`}
            onPointerDown={beginToolDrag(tool)}
            className="grid h-8 w-8 cursor-grab place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink"
          >
            <Icon icon={tool.icon} size={18} />
          </button>
        ))}

        {overflow.length > 0 && (
          <button
            type="button"
            aria-label="Tool lainnya"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink"
          >
            <Icon icon={MoreHorizontal} size={18} />
          </button>
        )}

        <div aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />

        <button
          type="button"
          aria-label="Perkecil"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => tweenTo(useCanvasStore.getState().viewport.zoom / STEP)}
          className="grid h-8 w-8 place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <Icon icon={Minus} size={16} />
        </button>

        <button
          type="button"
          aria-label={`Zoom ${percent} persen, klik untuk reset ke 100 persen`}
          onClick={() => tweenTo(1)}
          // min-width keeps the bar from shifting between "100%" and "75%".
          className="h-8 min-w-[44px] rounded-sm px-1 text-xs tabular-nums text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink"
        >
          {percent}%
        </button>

        <button
          type="button"
          aria-label="Perbesar"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => tweenTo(useCanvasStore.getState().viewport.zoom * STEP)}
          className="grid h-8 w-8 place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <Icon icon={Plus} size={16} />
        </button>
      </div>

      {/* Drag ghost — fixed so it rides the pointer across the whole viewport. */}
      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm text-ink shadow-drag"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -120%)' }}
        >
          <Icon icon={drag.tool.icon} size={16} />
          {drag.tool.label}
        </div>
      )}
    </div>
  )
}
