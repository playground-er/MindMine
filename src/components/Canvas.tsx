import { useEffect, useRef } from 'react'

import { useCanvasGestures } from '../hooks/useCanvasGestures'
import { useCanvasStore } from '../store/canvasStore'
import type { Viewport } from '../types/canvas'
import { EmptyState } from './EmptyState'
import { ZoomControl } from './ZoomControl'

/** Dot spacing at 100%. Snap is 8px; the grid draws every third step. */
const GRID_BASE = 24

/**
 * The grid layer is inset past the viewport on all sides so that translating
 * it by up to one full gap never exposes an edge. Must exceed GRID_BASE *
 * ZOOM_MAX (48px).
 */
const GRID_BLEED = 64

function dotSize(zoom: number): number {
  return Math.min(1.4, Math.max(0.6, zoom))
}

/** Fades out below 50% (to 0 at 25%) and above 150% (to 0.5 at 200%). */
function gridOpacity(zoom: number): number {
  if (zoom < 0.5) return Math.max(0, (zoom - 0.25) / 0.25)
  if (zoom > 1.5) return 1 - 0.5 * Math.min(1, (zoom - 1.5) / 0.5)
  return 1
}

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)

  useCanvasGestures(viewportRef)

  /**
   * Viewport changes are written straight to the DOM instead of through React
   * state. Pan fires every frame; re-rendering the tree that often is the
   * thing that makes a canvas feel heavy. Both layers move by transform only,
   * so pan stays on the compositor with no layout or paint.
   */
  useEffect(() => {
    let lastZoom = Number.NaN

    const apply = ({ x, y, zoom }: Viewport) => {
      const world = worldRef.current
      const grid = gridRef.current
      if (!world || !grid) return

      world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`

      const gap = GRID_BASE * zoom
      // The pattern repeats every `gap`, so translating by the remainder is
      // visually identical to translating by the full offset — and keeps the
      // element inside its bleed area.
      const tx = ((x % gap) + gap) % gap
      const ty = ((y % gap) + gap) % gap
      grid.style.transform = `translate3d(${tx}px, ${ty}px, 0)`

      // Repaint-inducing properties are touched only when zoom actually moves.
      if (zoom !== lastZoom) {
        lastZoom = zoom
        const r = dotSize(zoom)
        grid.style.backgroundSize = `${gap}px ${gap}px`
        grid.style.backgroundImage = `radial-gradient(circle, var(--dot) ${r}px, transparent ${r}px)`
        grid.style.opacity = String(gridOpacity(zoom))
      }
    }

    apply(useCanvasStore.getState().viewport)

    return useCanvasStore.subscribe((state, prev) => {
      if (state.viewport !== prev.viewport) apply(state.viewport)
    })
  }, [])

  const isPanning = useCanvasStore((s) => s.isPanning)

  return (
    <div
      ref={viewportRef}
      role="application"
      aria-label="Papan MindMine"
      tabIndex={0}
      className="relative h-full w-full touch-none overflow-hidden bg-canvas outline-none"
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
    >
      <div
        ref={gridRef}
        aria-hidden="true"
        className="pointer-events-none absolute will-change-transform"
        style={{
          top: -GRID_BLEED,
          right: -GRID_BLEED,
          bottom: -GRID_BLEED,
          left: -GRID_BLEED,
          backgroundPosition: '8px 8px',
        }}
      />

      <div
        ref={worldRef}
        className="absolute left-0 top-0 will-change-transform"
        style={{ transformOrigin: '0 0' }}
      >
        {/* Cards land here in Tahap 2. */}
      </div>

      <EmptyState />
      <ZoomControl />
    </div>
  )
}
