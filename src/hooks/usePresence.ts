import { useEffect, useRef } from 'react'

import { getSupabase } from '../lib/supabase'
import { useBoardStore } from '../store/boardStore'
import { usePresenceStore, type PeerCursor } from '../store/presenceStore'

/** PRD section 7: cursor broadcasts are throttled to 60ms. */
const THROTTLE_MS = 60
/** A peer that has said nothing for this long is treated as gone. */
const STALE_MS = 15_000
const SWEEP_MS = 5000

interface Options {
  boardId: string
  memberId: string
  /** Converts a client point to world coordinates for the current viewport. */
  toWorld: (clientX: number, clientY: number) => { x: number; y: number }
}

/**
 * Cursor and selection presence over a broadcast channel.
 *
 * Never touches the database — CLAUDE.md rule 3. Nothing here is worth a row:
 * it is all invalid the moment someone closes the tab.
 */
export function usePresence({ boardId, memberId, toWorld }: Options) {
  const toWorldRef = useRef(toWorld)
  toWorldRef.current = toWorld

  useEffect(() => {
    const sb = getSupabase()
    const channel = sb.channel(`presence:${boardId}`, {
      config: { presence: { key: memberId }, broadcast: { self: false } },
    })

    const store = usePresenceStore.getState()

    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      const peer = payload as PeerCursor
      if (peer.memberId === memberId) return
      store.applyPeer({ ...peer, updatedAt: Date.now() })
    })

    channel.on('presence', { event: 'sync' }, () => {
      store.setOnline(Object.keys(channel.presenceState()))
    })

    channel.on('presence', { event: 'leave' }, ({ key }) => store.dropPeer(key))

    void channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        usePresenceStore.getState().setOffline(false)
        await channel.track({ memberId })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        usePresenceStore.getState().setOffline(true)
      }
    })

    let lastSent = 0
    let timer: number | undefined

    const send = (clientX: number, clientY: number) => {
      const world = toWorldRef.current(clientX, clientY)
      const { editingId, selectedId } = useBoardStore.getState()
      void channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: {
          memberId,
          x: world.x,
          y: world.y,
          editingCardId: editingId,
          selectedCardId: selectedId,
          updatedAt: Date.now(),
        } satisfies PeerCursor,
      })
    }

    const onPointerMove = (e: PointerEvent) => {
      const now = Date.now()
      const elapsed = now - lastSent

      if (elapsed >= THROTTLE_MS) {
        lastSent = now
        send(e.clientX, e.clientY)
        return
      }

      // Trailing edge: without it, the cursor freezes wherever the last
      // throttle window happened to close instead of where the pointer stopped.
      window.clearTimeout(timer)
      const { clientX, clientY } = e
      timer = window.setTimeout(() => {
        lastSent = Date.now()
        send(clientX, clientY)
      }, THROTTLE_MS - elapsed)
    }

    const onOffline = () => usePresenceStore.getState().setOffline(true)
    const onOnline = () => usePresenceStore.getState().setOffline(false)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    // Peers that crash or lose signal never send a leave event.
    const sweep = window.setInterval(() => {
      const cutoff = Date.now() - STALE_MS
      const { peers, dropPeer } = usePresenceStore.getState()
      for (const peer of Object.values(peers)) {
        if (peer.updatedAt < cutoff) dropPeer(peer.memberId)
      }
    }, SWEEP_MS)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      window.clearTimeout(timer)
      window.clearInterval(sweep)
      usePresenceStore.getState().reset()
      void sb.removeChannel(channel)
    }
  }, [boardId, memberId])
}
