import { create } from 'zustand'

import type { Point, Viewport } from '../types/canvas'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2

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

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: { ...state.viewport, x: state.viewport.x + dx, y: state.viewport.y + dy },
    })),

  zoomBy: (factor, origin) =>
    set((state) => ({ viewport: anchoredZoom(state.viewport, state.viewport.zoom * factor, origin) })),

  zoomTo: (zoom, origin) =>
    set((state) => ({ viewport: anchoredZoom(state.viewport, zoom, origin) })),

  resetZoom: (origin) => set((state) => ({ viewport: anchoredZoom(state.viewport, 1, origin) })),

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
