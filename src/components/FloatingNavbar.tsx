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
import { useState } from 'react'

import { useZoomTween } from '../hooks/useZoomTween'
import { useCanvasStore, ZOOM_MAX, ZOOM_MIN } from '../store/canvasStore'
import type { CardType } from '../types/db'
import { Icon } from './Icon'

const STEP = 1.25

/** Tools beyond this collapse into the overflow, least-used first. */
const MAX_INLINE = 4

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

interface Props {
  onCreate: (type: CardType) => void
}

export function FloatingNavbar({ onCreate }: Props) {
  const zoom = useCanvasStore((s) => s.viewport.zoom)
  const tweenTo = useZoomTween()
  const [expanded, setExpanded] = useState(false)

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
              onClick={() => {
                onCreate(tool.type)
                setExpanded(false)
              }}
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
            title={tool.label}
            aria-label={`Buat ${tool.label}`}
            onClick={() => onCreate(tool.type)}
            className="grid h-8 w-8 place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink"
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
    </div>
  )
}
