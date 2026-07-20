import { useCallback, useEffect, useRef } from 'react'

import { useCanvasStore, ZOOM_MAX, ZOOM_MIN } from '../store/canvasStore'
import type { Point } from '../types/canvas'

/** Spec section 10: gestures are instant, button presses ease over 180ms. */
const TWEEN_MS = 180

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/** Animated zoom for button presses, anchored on the middle of the viewport. */
export function useZoomTween() {
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return useCallback((target: number) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    const { viewSize, viewport, zoomTo } = useCanvasStore.getState()
    const origin: Point = { x: viewSize.w / 2, y: viewSize.h / 2 }
    const from = viewport.zoom
    const to = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, target))
    if (from === to) return

    const start = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS)
      zoomTo(from + (to - from) * ease(t), origin)
      frameRef.current = t < 1 ? requestAnimationFrame(step) : null
    }

    frameRef.current = requestAnimationFrame(step)
  }, [])
}
