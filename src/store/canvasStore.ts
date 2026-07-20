import { create } from 'zustand'

import type { Point, Viewport } from '../types/canvas'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2

/**
 * The board is finite.
 *
 * DESIGN-SPEC section 7 originally called for "rasa ruang tak terbatas tanpa
 * border", but an unbounded plane gives nothing to orient against: pan far
 * enough and every screen looks identical with no way back. These numbers are
 * the one knob for how large the board feels — change them here, nothing else
 * hard-codes an extent.
 */
export const BOARD_W = 4000
export const BOARD_H = 3000

/**
 * Keeps the board covering the viewport, or centred when it is smaller than
 * the viewport (which happens once you zoom far enough out).
 */
function clampViewport(viewport: Viewport, viewW: number, viewH: number): Viewport {
  const scaledW = BOARD_W * viewport.zoom
  const scaledH = BOARD_H * viewport.zoom

  const x = scaledW <= viewW ? (viewW - scaledW) / 2 : Math.min(0, Math.max(viewW - scaledW, viewport.x))
  const y = scaledH <= viewH ? (viewH - scaledH) / 2 : Math.min(0, Math.max(viewH - scaledH, viewport.y))

  if (x === viewport.x && y === viewport.y) return viewport
  return { ...viewport, x, y }
}

/** Viewport lives in localStorage, never on the server — it is per-person. */
const STORAGE_KEY = 'mindmine:viewport'

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

function readStoredViewport(): Viewport {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VIEWPORT

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_VIEWPORT

    const { x, y, zoom } = parsed as Record<string, unknown>
    if (typeof x !== 'number' || typeof y !== 'number' || typeof zoom !== 'number') {
      return DEFAULT_VIEWPORT
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) {
      return DEFAULT_VIEWPORT
    }

    return { x, y, zoom: clampZoom(zoom) }
  } catch {
    // Private mode, quota, or hand-edited garbage. Falling back is correct;
    // a broken viewport should never block the board from opening.
    return DEFAULT_VIEWPORT
  }
}

interface CanvasState {
  viewport: Viewport
  /** True while space is held or a pan drag is in flight — drives the cursor. */
  isPanning: boolean
  /** Viewport pixel size, needed to clamp pan against the board bounds. */
  viewSize: { w: number; h: number }

  setViewSize: (w: number, h: number) => void
  panBy: (dx: number, dy: number) => void
  /** Zoom by a multiplier while keeping `origin` (screen coords) fixed. */
  zoomBy: (factor: number, origin: Point) => void
  /** Zoom to an absolute level, anchored on `origin` (screen coords). */
  zoomTo: (zoom: number, origin: Point) => void
  resetZoom: (origin: Point) => void
  setPanning: (isPanning: boolean) => void
}

/** Keeps `origin` pinned to the same world point across a zoom change. */
function anchoredZoom(viewport: Viewport, nextZoom: number, origin: Point): Viewport {
  const zoom = clampZoom(nextZoom)
  if (zoom === viewport.zoom) return viewport

  // world = (screen - offset) / zoom, then solve offset for the new zoom.
  const worldX = (origin.x - viewport.x) / viewport.zoom
  const worldY = (origin.y - viewport.y) / viewport.zoom

  return {
    x: origin.x - worldX * zoom,
    y: origin.y - worldY * zoom,
    zoom,
  }
}

export const useCanvasStore = create<CanvasState>((set) => ({
  viewport: readStoredViewport(),
  isPanning: false,
  viewSize: { w: window.innerWidth, h: window.innerHeight },

  setViewSize: (w, h) =>
    set((state) => ({
      viewSize: { w, h },
      // Resizing smaller can leave the board off-screen; re-clamp immediately.
      viewport: clampViewport(state.viewport, w, h),
    })),

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: clampViewport(
        { ...state.viewport, x: state.viewport.x + dx, y: state.viewport.y + dy },
        state.viewSize.w,
        state.viewSize.h,
      ),
    })),

  zoomBy: (factor, origin) =>
    set((state) => ({
      viewport: clampViewport(
        anchoredZoom(state.viewport, state.viewport.zoom * factor, origin),
        state.viewSize.w,
        state.viewSize.h,
      ),
    })),

  zoomTo: (zoom, origin) =>
    set((state) => ({
      viewport: clampViewport(
        anchoredZoom(state.viewport, zoom, origin),
        state.viewSize.w,
        state.viewSize.h,
      ),
    })),

  resetZoom: (origin) =>
    set((state) => ({
      viewport: clampViewport(
        anchoredZoom(state.viewport, 1, origin),
        state.viewSize.w,
        state.viewSize.h,
      ),
    })),

  setPanning: (isPanning) => set({ isPanning }),
}))

/**
 * Persist on idle rather than on every frame. Pan fires hundreds of updates a
 * second; localStorage writes are synchronous and would stall the main thread.
 */
let persistTimer: number | undefined

useCanvasStore.subscribe((state, prev) => {
  if (state.viewport === prev.viewport) return

  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.viewport))
    } catch {
      // Storage full or blocked. Losing scroll position is not worth throwing.
    }
  }, 300)
})
