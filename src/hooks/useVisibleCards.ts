import { useEffect, useMemo, useRef, useState } from 'react'

import { sameIdSet, SpatialIndex, type Rect } from '../lib/spatialIndex'
import { useCanvasStore } from '../store/canvasStore'
import type { Card } from '../types/db'
import type { Viewport } from '../types/canvas'

/** Cards this far outside the viewport still render, so panning reveals them already mounted. */
const MARGIN = 200

function visibleWorldRect(viewport: Viewport, width: number, height: number): Rect {
  return {
    x: -viewport.x / viewport.zoom - MARGIN,
    y: -viewport.y / viewport.zoom - MARGIN,
    w: width / viewport.zoom + MARGIN * 2,
    h: height / viewport.zoom + MARGIN * 2,
  }
}

/**
 * The subset of cards worth mounting for the current viewport.
 *
 * Pan deliberately does not re-render React — the canvas writes transforms
 * straight to the DOM. So culling cannot ride the render cycle; it subscribes
 * to the store itself, recomputes at most once a frame, and only calls
 * setState when the visible set actually changed. Without that last check a
 * pan would re-render the board on every frame, which is the cost culling was
 * supposed to remove.
 */
export function useVisibleCards(cards: Card[]): Card[] {
  const index = useMemo(() => new SpatialIndex(cards), [cards])
  const indexRef = useRef(index)
  indexRef.current = index

  const [visibleIds, setVisibleIds] = useState<Set<string>>(() =>
    index.query(visibleWorldRect(useCanvasStore.getState().viewport, window.innerWidth, window.innerHeight)),
  )
  const visibleRef = useRef(visibleIds)
  visibleRef.current = visibleIds

  useEffect(() => {
    let frame: number | null = null

    const recompute = () => {
      frame = null
      const next = indexRef.current.query(
        visibleWorldRect(useCanvasStore.getState().viewport, window.innerWidth, window.innerHeight),
      )
      if (sameIdSet(next, visibleRef.current)) return
      visibleRef.current = next
      setVisibleIds(next)
    }

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(recompute)
    }

    recompute()

    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      if (state.viewport !== prev.viewport) schedule()
    })
    window.addEventListener('resize', schedule)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      unsubscribe()
      window.removeEventListener('resize', schedule)
    }
  }, [index])

  return useMemo(() => cards.filter((c) => visibleIds.has(c.id)), [cards, visibleIds])
}
