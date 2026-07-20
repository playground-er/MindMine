import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchOrCreateRootBoard } from '../api/board'
import {
  createNoteCard,
  listCards,
  restoreCard,
  softDeleteCard,
  updateCardGeometry,
  updateCardText,
} from '../api/cards'
import { listMembers } from '../api/members'
import { snap } from '../lib/geometry'
import { useBoardStore } from '../store/boardStore'
import type { Point } from '../types/canvas'
import type { Card, Member } from '../types/db'
import { Canvas } from './Canvas'
import { EmptyState } from './EmptyState'
import { NoteCard } from './NoteCard'
import { Toast } from './Toast'

const UNDO_WINDOW_MS = 5000

export function BoardView({ member }: { member: Member }) {
  const queryClient = useQueryClient()
  const [pendingUndo, setPendingUndo] = useState<string | null>(null)

  const selectedId = useBoardStore((s) => s.selectedId)
  const editingId = useBoardStore((s) => s.editingId)
  const select = useBoardStore((s) => s.select)
  const beginEdit = useBoardStore((s) => s.beginEdit)

  const boardQuery = useQuery({
    queryKey: ['root-board'],
    queryFn: () => fetchOrCreateRootBoard(member.id),
    staleTime: Infinity,
  })
  const boardId = boardQuery.data?.id

  const membersQuery = useQuery({ queryKey: ['members'], queryFn: listMembers, staleTime: 300_000 })

  const cardsQuery = useQuery({
    queryKey: ['cards', boardId],
    queryFn: () => listCards(boardId!),
    enabled: Boolean(boardId),
  })

  const cardsKey = useMemo(() => ['cards', boardId] as const, [boardId])

  /** Applies a local edit to the cached list so the UI never waits on the server. */
  const patchCache = useCallback(
    (id: string, patch: Partial<Card>) => {
      queryClient.setQueryData<Card[]>(cardsKey, (prev) =>
        prev?.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      )
    },
    [queryClient, cardsKey],
  )

  const createMutation = useMutation({
    mutationFn: (world: Point) =>
      createNoteCard({
        boardId: boardId!,
        memberId: member.id,
        x: snap(world.x, true),
        y: snap(world.y, true),
        z: (cardsQuery.data?.length ?? 0) + 1,
      }),
    onSuccess: (card) => {
      queryClient.setQueryData<Card[]>(cardsKey, (prev) => [...(prev ?? []), card])
      beginEdit(card.id)
    },
  })

  const geometryMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: { x: number; y: number; w: number } }) =>
      updateCardGeometry(id, next, member.id),
    onError: () => void queryClient.invalidateQueries({ queryKey: cardsKey }),
  })

  const textMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateCardText(id, text, member.id),
    onError: () => void queryClient.invalidateQueries({ queryKey: cardsKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteCard(id, member.id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Card[]>(cardsKey, (prev) => prev?.filter((c) => c.id !== id))
      setPendingUndo(id)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreCard(id, member.id),
    onSuccess: () => {
      setPendingUndo(null)
      void queryClient.invalidateQueries({ queryKey: cardsKey })
    },
  })

  // The undo offer expires on its own; the card stays recoverable for 30 days.
  useEffect(() => {
    if (!pendingUndo) return
    const timer = window.setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [pendingUndo])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (!selectedId || editingId) return

      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'TEXTAREA')) {
        return
      }

      e.preventDefault()
      deleteMutation.mutate(selectedId)
      select(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, editingId, deleteMutation, select])

  const memberNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of membersQuery.data ?? []) map.set(m.id, m.name)
    return map
  }, [membersQuery.data])

  /**
   * These take the card id as an argument rather than being built per card.
   * A closure created inside the map would be a new function identity on every
   * render, and NoteCard's memo comparator would never hold.
   */
  const commitGeometry = useCallback(
    (id: string, next: { x: number; y: number; w: number }) => {
      patchCache(id, next)
      geometryMutation.mutate({ id, next })
    },
    [patchCache, geometryMutation],
  )

  const commitText = useCallback(
    (id: string, text: string) => {
      patchCache(id, { content: { text } })
      textMutation.mutate({ id, text })
    },
    [patchCache, textMutation],
  )

  if (boardQuery.isError) {
    return <CenteredMessage text="Gagal memuat board. Muat ulang halaman." />
  }
  if (!boardId || cardsQuery.isLoading) {
    return <CenteredMessage text="Memuat…" />
  }

  const cards = cardsQuery.data ?? []

  return (
    <Canvas
      onCreateAt={(world) => createMutation.mutate(world)}
      onBackgroundClick={() => select(null)}
      overlay={
        <>
          {cards.length === 0 && <EmptyState />}
          {pendingUndo && (
            <Toast
              message="Kartu dihapus."
              actionLabel="Urungkan"
              onAction={() => restoreMutation.mutate(pendingUndo)}
            />
          )}
        </>
      }
    >
      {cards.map((card) => (
        <NoteCard
          key={card.id}
          card={card}
          authorName={memberNames.get(card.updated_by) ?? '—'}
          isSelected={selectedId === card.id}
          isEditing={editingId === card.id}
          onCommitGeometry={commitGeometry}
          onCommitText={commitText}
        />
      ))}
    </Canvas>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas">
      <p className="text-sm text-ink-secondary">{text}</p>
    </div>
  )
}
