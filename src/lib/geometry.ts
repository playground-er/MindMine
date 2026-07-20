import type { Point, Viewport } from '../types/canvas'

/** Snap step from the design tokens (--grid). Dot grid draws every third one. */
export const SNAP = 8

/** Hold ⌥ to place freely; otherwise everything lands on the 8px grid. */
export function snap(value: number, enabled: boolean): number {
  return enabled ? Math.round(value / SNAP) * SNAP : Math.round(value)
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  }
}
