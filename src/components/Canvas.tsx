import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'

import { useCanvasGestures } from '../hooks/useCanvasGestures'
import { screenToWorld } from '../lib/geometry'
import { BOARD_H, BOARD_W, useCanvasStore } from '../store/canvasStore'
import type { Point, Viewport } from '../types/canvas'

/** Dot spacing in world units. Snap is 8px; the grid draws every third step. */
const GRID_BASE = 24

/** Clamped so dots neither vanish when zoomed out nor read as polka dots zoomed in. */
function dotSize(zoom: number): number {
  return Math.min(1.4, Math.max(0.6, zoom))
}

/** Fades out below 50% (to 0 at 25%) and above 150% (to 0.5 at 200%). */
function gridOpacity(zoom: number): number {
  if (zoom < 0.5) return Math.max(0, (zoom - 0.25) / 0.25)
  if (zoom > 1.5) return 1 - 0.5 * Math.min(1, (zoom - 1.5) / 0.5)
  return 1
}

interface Props {
  children?: ReactNode
  /** Screen-space chrome: header, toasts, empty state. */
  overlay?: ReactNode
  /** Lives inside the transformed world layer — peer cursors, snap guides. */
  worldOverlay?: ReactNode
  /** Mirrors the viewport element out, so callers can map client to world. */
  viewportRef?: MutableRefObject<HTMLElement | null>
  onCreateAt?: (world: Point) => void
  onBackgroundClick?: () => void
}

export function Canvas({
  children,
  overlay,
  worldOverlay,
  viewportRef: externalViewportRef,
  onCreateAt,
  onBackgroundClick,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useCanvasGestures(viewportRef)

  useEffect(() => {
    if (!externalViewportRef) return
    externalViewportRef.current = viewportRef.current
  }, [externalViewportRef])

  // Pan clamping needs to know how big the window is.
  useEffect(() => {
    const report = () => {
      const el = viewportRef.current
      if (!el) return
      useCanvasStore.getState().setViewSize(el.clientWidth, el.clientHeight)
    }
    report()
    window.addEventListener('resize', report)
    return () => window.removeEventListener('resize', report)
  }, [])

  /**
   * Viewport changes are written straight to the DOM instead of through React
   * state. Pan fires every frame; re-rendering the tree that often is the thing
   * that makes a canvas feel heavy.
   *
   * The dot grid rides the world layer rather than screen space, so panning is
   * one transform on one element — no repaint at all — and the grid clips
   * itself to the board edge for free. Its background-size is in world units,
   * which the layer's own scale turns into the right on-screen spacing.
   */
  useEffect(() => {
    let lastZoom = Number.NaN

    const apply = ({ x, y, zoom }: Viewport) => {
      const world = worldRef.current
      const board = boardRef.current
      if (!world || !board) return

      world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`

      if (zoom !== lastZoom) {
        lastZoom = zoom
        // Radius is divided by zoom so it stays constant on screen.
        const r = dotSize(zoom) / zoom
        board.style.backgroundImage = `radial-gradient(circle, var(--dot) ${r}px, transparent ${r}px)`
        board.style.opacity = String(gridOpacity(zoom))
      }
    }

    apply(useCanvasStore.getState().viewport)

    return useCanvasStore.subscribe((state, prev) => {
      if (state.viewport !== prev.viewport) apply(state.viewport)
    })
  }, [])

  const isPanning = useCanvasStore((s) => s.isPanning)

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return screenToWorld(
      { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) },
      useCanvasStore.getState().viewport,
    )
  }

  return (
    <div
      ref={viewportRef}
      role="application"
      aria-label="Papan MindMine"
      tabIndex={0}
      // Outside the board reads as a different surface, so the edge is legible
      // without drawing attention to itself.
      className="relative h-full w-full touch-none overflow-hidden bg-surface-inset outline-none"
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      // Cards and chrome stop propagation, so an event that reaches this
      // handler came from empty canvas.
      onPointerDown={() => onBackgroundClick?.()}
      onDoubleClick={(e) => {
        const world = toWorld(e.clientX, e.clientY)
        if (world.x < 0 || world.y < 0 || world.x > BOARD_W || world.y > BOARD_H) return
        onCreateAt?.(world)
      }}
    >
      <div
        ref={worldRef}
        className="absolute left-0 top-0 will-change-transform"
        style={{ transformOrigin: '0 0' }}
      >
        <div
          ref={boardRef}
          aria-hidden="true"
          className="absolute left-0 top-0 bg-canvas"
          style={{
            width: BOARD_W,
            height: BOARD_H,
            backgroundSize: `${GRID_BASE}px ${GRID_BASE}px`,
            backgroundPosition: '8px 8px',
            boxShadow: '0 0 0 1px var(--border)',
          }}
        />

        {children}
        {worldOverlay}
      </div>

      {overlay}
    </div>
  )
}
