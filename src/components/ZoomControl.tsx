import { Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useCanvasStore, ZOOM_MAX, ZOOM_MIN } from '../store/canvasStore'
import type { Point } from '../types/canvas'
import { Icon } from './Icon'

const STEP = 1.25
/** Spec section 10: gestures are instant, button presses ease over 180ms. */
const TWEEN_MS = 180
const IDLE_MS = 2000

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export function ZoomControl() {
  const zoom = useCanvasStore((s) => s.viewport.zoom)
  const [isIdle, setIsIdle] = useState(false)
  const frameRef = useRef<number | null>(null)

  // Fade back after 2s of no zoom change. Depending on `zoom` restarts the
  // timer on every change, which is exactly the intended behaviour.
  useEffect(() => {
    setIsIdle(false)
    const timer = window.setTimeout(() => setIsIdle(true), IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [zoom])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const tweenTo = useCallback((target: number) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    const origin: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const from = useCanvasStore.getState().viewport.zoom
    const to = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, target))
    if (from === to) return

    const start = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS)
      useCanvasStore.getState().zoomTo(from + (to - from) * ease(t), origin)
      frameRef.current = t < 1 ? requestAnimationFrame(step) : null
    }

    frameRef.current = requestAnimationFrame(step)
  }, [])

  const percent = Math.round(zoom * 100)

  return (
    <div
      className="absolute bottom-4 right-4 flex items-center gap-0 rounded-inset p-1 transition-opacity duration-[120ms]"
      style={{
        background: 'rgba(255,254,251,0.9)',
        backdropFilter: 'blur(8px)',
        boxShadow: 'var(--shadow-card)',
        opacity: isIdle ? 0.45 : 1,
      }}
      onPointerEnter={() => setIsIdle(false)}
      // Reaching the canvas would deselect the current card and start a pan.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Perkecil"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => tweenTo(useCanvasStore.getState().viewport.zoom / STEP)}
        className="grid h-7 w-7 place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon icon={Minus} size={16} />
      </button>

      <button
        type="button"
        aria-label={`Zoom ${percent} persen, klik untuk reset ke 100 persen`}
        onClick={() => tweenTo(1)}
        // min-width keeps the track from shifting between "100%" and "75%".
        className="h-7 min-w-[40px] rounded-sm px-1 text-xs tabular-nums text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink"
      >
        {percent}%
      </button>

      <button
        type="button"
        aria-label="Perbesar"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => tweenTo(useCanvasStore.getState().viewport.zoom * STEP)}
        className="grid h-7 w-7 place-items-center rounded-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-surface-inset hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon icon={Plus} size={16} />
      </button>
    </div>
  )
}
