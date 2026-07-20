import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getSupabase } from '../lib/supabase'
import { useBoardStore } from '../store/boardStore'
import type { Card } from '../types/db'

/**
 * Geometry, creation and deletion over `postgres_changes` — last-write-wins.
 *
 * CLAUDE.md rule 1 keeps this separate from the CRDT layer on purpose. A
 * conflicting position is visible and takes one drag to fix; paying CRDT costs
 * for two integers buys nothing. Text never travels through here.
 */
export function useRealtimeCards(boardId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!boardId) return

    const sb = getSupabase()
    const key = ['cards', boardId]

    const channel = sb
      .channel(`cards:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card', filter: `board_id=eq.${boardId}` },
        (payload) => {
          const row = payload.new as Card | undefined

          if (payload.eventType === 'DELETE' || (row && row.deleted_at !== null)) {
            const id = row?.id ?? (payload.old as { id?: string }).id
            if (!id) return
            queryClient.setQueryData<Card[]>(key, (prev) => prev?.filter((c) => c.id !== id))
            return
          }

          if (!row) return

          /**
           * A card being dragged locally is authoritative until the pointer is
           * released. Accepting an echo mid-gesture would snap it back to the
           * position the server last heard about.
           */
          if (useBoardStore.getState().draggingId === row.id) return

          queryClient.setQueryData<Card[]>(key, (prev) => {
            if (!prev) return prev
            const index = prev.findIndex((c) => c.id === row.id)
            if (index === -1) return [...prev, row]

            const next = [...prev]
            // Note and todo content is owned by Yjs; taking the server's copy
            // would fight whatever the local doc holds mid-edit. Image and
            // link content is LWW and the server copy is the newer truth
            // (e.g. link metadata resolved by another tab).
            const yjsOwned = row.type === 'note' || row.type === 'todo'
            next[index] = yjsOwned ? { ...row, content: prev[index]!.content } : row
            return next
          })
        },
      )
      .subscribe()

    return () => {
      void sb.removeChannel(channel)
    }
  }, [boardId, queryClient])
}
