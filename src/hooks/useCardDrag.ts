import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

import { snap } from '../lib/geometry'
import { useBoardStore } from '../store/boardStore'
import { useCanvasStore } from '../store/canvasStore'

interface Geometry {
  x: number
  y: number
  w: number
}

interface Options {
  cardId: string
  elementRef: RefObject<HTMLElement | null>
  geometry: Geometry
  onCommit: (next: Geometry) => void
}

/** Below this the pointer is treated as a click, not a drag. */
const DRAG_THRESHOLD = 3

/**
 * Drag and width-resize for a card.
 *
 * The card's transform is written directly to the DOM for the duration of the
 * gesture and the result is committed once on release. Routing every pointer
 * event through React state would re-render the card — and later every other
 * card — sixty times a second for a value that is only durable at the end.
 */
export function useCardDrag({ cardId, elementRef, geometry, onCommit }: Options) {
  const stateRef = useRef({ ...geometry })
  stateRef.current = { ...geometry }

  const begin = useCallback(
    (e: ReactPointerEvent, mode: 'move' | 'resize') => {
      if (e.button !== 0) return
      e.stopPropagation() // do not let the canvas start a pan

      const el = elementRef.current
      if (!el) return

      const startClientX = e.clientX
      const startClientY = e.clientY
      const origin = { ...stateRef.current }
      const zoom = useCanvasStore.getState().viewport.zoom

      let moved = false
      let next = { ...origin }
      let frame: number | null = null
      let pendingEvent: { x: number; y: number; alt: boolean } | null = null

      const paint = () => {
        frame = null
        if (!pendingEvent) return

        // Pointer travel is in screen pixels; the world is scaled by zoom.
        const dx = (pendingEvent.x - startClientX) / zoom
        const dy = (pendingEvent.y - startClientY) / zoom
        const shouldSnap = !pendingEvent.alt

        if (mode === 'move') {
          next = {
            ...origin,
            x: snap(origin.x + dx, shouldSnap),
            y: snap(origin.y + dy, shouldSnap),
          }
          el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
        } else {
          // Notes grow with their content, so only width is resizable.
          next = { ...origin, w: Math.max(160, snap(origin.w + dx, shouldSnap)) }
          el.style.width = `${next.w}px`
        }
      }

      const onMove = (ev: PointerEvent) => {
        if (
          !moved &&
          Math.abs(ev.clientX - startClientX) < DRAG_THRESHOLD &&
          Math.abs(ev.clientY - startClientY) < DRAG_THRESHOLD
        ) {
          return
        }
        if (!moved) {
          moved = true
          useBoardStore.getState().setDragging(cardId)
        }

        pendingEvent = { x: ev.clientX, y: ev.clientY, alt: ev.altKey }
        if (frame === null) frame = requestAnimationFrame(paint)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        if (frame !== null) cancelAnimationFrame(frame)

        if (!moved) return
        useBoardStore.getState().setDragging(null)
        stateRef.current = next
        onCommit(next)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [cardId, elementRef, onCommit],
  )

  return {
    onMovePointerDown: (e: ReactPointerEvent) => begin(e, 'move'),
    onResizePointerDown: (e: ReactPointerEvent) => begin(e, 'resize'),
  }
}
