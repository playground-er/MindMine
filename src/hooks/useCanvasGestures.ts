import { useEffect, type RefObject } from 'react'

import { useCanvasStore, ZOOM_MAX, ZOOM_MIN } from '../store/canvasStore'

/** Trackpad pinch and ⌘+wheel both arrive as ctrlKey wheel events. */
const ZOOM_SENSITIVITY = 0.01

/**
 * Elements that handle their own pointer gestures.
 *
 * Pan is bound with addEventListener on the viewport, so it fires during the
 * native bubble phase — before React dispatches its synthetic handlers at the
 * root. A card calling stopPropagation in its own onPointerDown is therefore
 * already too late, and dragging a card would pan the board underneath it,
 * which looks exactly like every card moving at once. The check has to happen
 * here instead.
 */
const NO_PAN_SELECTOR = '[data-no-pan]'

function isOwnGesture(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NO_PAN_SELECTOR) !== null
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

/**
 * Wires pan and zoom onto the canvas viewport element.
 *
 * Pan: hold space and drag, drag empty canvas, or two-finger scroll.
 * Zoom: ⌘/ctrl + scroll, clamped to 25%–200%.
 *
 * Deltas are accumulated and flushed once per frame. Raw pointer and wheel
 * events can fire faster than the display refreshes; writing the store on
 * every one of them is wasted work that shows up as jank under load.
 */
export function useCanvasGestures(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const { panBy, zoomBy, setPanning } = useCanvasStore.getState()

    let spaceHeld = false
    let isDragging = false
    let activePointerId: number | null = null

    let pendingPanX = 0
    let pendingPanY = 0
    let pendingZoom = 1
    let zoomOriginX = 0
    let zoomOriginY = 0
    let frame: number | null = null

    const flush = () => {
      frame = null

      if (pendingZoom !== 1) {
        zoomBy(pendingZoom, { x: zoomOriginX, y: zoomOriginY })
        pendingZoom = 1
      }
      if (pendingPanX !== 0 || pendingPanY !== 0) {
        panBy(pendingPanX, pendingPanY)
        pendingPanX = 0
        pendingPanY = 0
      }
    }

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(flush)
    }

    const onWheel = (e: WheelEvent) => {
      // Always prevent default: unhandled ctrl+wheel triggers browser page
      // zoom, and unhandled plain wheel scrolls the document behind the canvas.
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        pendingZoom *= Math.exp(-e.deltaY * ZOOM_SENSITIVITY)
        zoomOriginX = e.clientX
        zoomOriginY = e.clientY
      } else {
        pendingPanX -= e.deltaX
        pendingPanY -= e.deltaY
      }
      schedule()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return
      if (isEditable(e.target) || isOwnGesture(e.target)) return

      isDragging = true
      activePointerId = e.pointerId
      el.setPointerCapture(e.pointerId)
      setPanning(true)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || e.pointerId !== activePointerId) return
      pendingPanX += e.movementX
      pendingPanY += e.movementY
      schedule()
    }

    const endDrag = (e: PointerEvent) => {
      if (!isDragging || e.pointerId !== activePointerId) return
      isDragging = false
      activePointerId = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      setPanning(spaceHeld)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isEditable(e.target)) return
      e.preventDefault() // stop the space-scrolls-the-page default
      if (spaceHeld) return
      spaceHeld = true
      setPanning(true)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceHeld = false
      if (!isDragging) setPanning(false)
    }

    // Focus loss while space is down would otherwise leave the grab cursor stuck.
    const onBlur = () => {
      spaceHeld = false
      isDragging = false
      activePointerId = null
      setPanning(false)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [ref])
}

export { ZOOM_MAX, ZOOM_MIN }
