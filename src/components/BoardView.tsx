import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchOrCreateRootBoard } from '../api/board'
import {
  createNoteCard,
  flushCardDoc,
  listCards,
  restoreCard,
  softDeleteCard,
  updateCardGeometry,
} from '../api/cards'
import { listMembers } from '../api/members'
import { usePresence } from '../hooks/usePresence'
import { useRealtimeCards } from '../hooks/useRealtimeCards'
import { useVisibleCards } from '../hooks/useVisibleCards'
import { screenToWorld, snap } from '../lib/geometry'
import { TransportContext } from '../lib/transportContext'
import { YDocTransport } from '../lib/ydocTransport'
import { useBoardStore } from '../store/boardStore'
import { useCanvasStore } from '../store/canvasStore'
import { usePresenceStore } from '../store/presenceStore'
import type { Point } from '../types/canvas'
import type { Card, Member } from '../types/db'
import { Canvas } from './Canvas'
import { EmptyState } from './EmptyState'
import { FloatingNavbar } from './FloatingNavbar'
import { Header } from './Header'
import { NoteCard } from './NoteCard'
import { PresenceLayer } from './PresenceLayer'
import { Toast } from './Toast'

const UNDO_WINDOW_MS = 5000

/** Module scope so cards without peer editors keep a stable prop identity. */
const NO_EDITORS: Member[] = []

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

  useRealtimeCards(boardId)

  // One transport per board, torn down when the board changes.
  const [transport, setTransport] = useState<YDocTransport | null>(null)
  useEffect(() => {
    if (!boardId) return
    const next = new YDocTransport(boardId)
    setTransport(next)
    return () => {
      next.destroy()
      setTransport(null)
    }
  }, [boardId])

  const viewportElRef = useRef<HTMLElement | null>(null)
  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = viewportElRef.current?.getBoundingClientRect()
    return screenToWorld(
      { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) },
      useCanvasStore.getState().viewport,
    )
  }, [])

  usePresence({ boardId: boardId ?? '', memberId: member.id, toWorld })

  /** Navbar-created cards land in the middle of what you are looking at. */
  const viewportCenterWorld = useCallback((): Point => {
    const { viewport, viewSize } = useCanvasStore.getState()
    return screenToWorld({ x: viewSize.w / 2, y: viewSize.h / 2 }, viewport)
  }, [])

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

  const flushMutation = useMutation({
    mutationFn: ({ id, text, ydocHex }: { id: string; text: string; ydocHex: string }) =>
      flushCardDoc(id, ydocHex, text, member.id),
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
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'TEXTAREA')
      ) {
        return
      }

      e.preventDefault()
      deleteMutation.mutate(selectedId)
      select(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, editingId, deleteMutation, select])

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of membersQuery.data ?? []) map.set(m.id, m)
    return map
  }, [membersQuery.data])

  /**
   * Who is inside which card, derived once per presence change rather than
   * inside each card. Reading the presence store from NoteCard would couple
   * every card to cursor traffic — the coupling PRD section 11 warns about.
   */
  const peers = usePresenceStore((s) => s.peers)
  const editorsByCard = useMemo(() => {
    const map = new Map<string, Member[]>()
    for (const peer of Object.values(peers)) {
      if (!peer.editingCardId) continue
      const m = memberMap.get(peer.memberId)
      if (!m) continue
      const list = map.get(peer.editingCardId)
      if (list) list.push(m)
      else map.set(peer.editingCardId, [m])
    }
    return map
  }, [peers, memberMap])

  const commitGeometry = useCallback(
    (id: string, next: { x: number; y: number; w: number }) => {
      patchCache(id, next)
      geometryMutation.mutate({ id, next })
    },
    [patchCache, geometryMutation],
  )

  const onTextSettled = useCallback(
    (id: string, text: string, ydocHex: string) => {
      patchCache(id, { content: { text } })
      flushMutation.mutate({ id, text, ydocHex })
    },
    [patchCache, flushMutation],
  )

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data])
  const visibleCards = useVisibleCards(cards)
  const isCompact = useCanvasStore((s) => s.viewport.zoom < 0.5)

  if (boardQuery.isError) {
    return <CenteredMessage text="Gagal memuat board. Muat ulang halaman." />
  }
  if (!boardId || cardsQuery.isLoading) {
    return <CenteredMessage text="Memuat…" />
  }

  return (
    <TransportContext.Provider value={transport}>
      <Canvas
        viewportRef={viewportElRef}
        onCreateAt={(world) => createMutation.mutate(world)}
        onBackgroundClick={() => select(null)}
        worldOverlay={<PresenceLayer members={memberMap} />}
        overlay={
          <>
            <Header title={boardQuery.data?.title ?? 'MindMine'} members={memberMap} />
            <FloatingNavbar onCreate={() => createMutation.mutate(viewportCenterWorld())} />
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
        {visibleCards.map((card) => (
          <NoteCard
            key={card.id}
            card={card}
            isCompact={isCompact}
            authorName={memberMap.get(card.updated_by)?.name ?? '—'}
            isSelected={selectedId === card.id}
            isEditing={editingId === card.id}
            peerEditors={editorsByCard.get(card.id) ?? NO_EDITORS}
            onCommitGeometry={commitGeometry}
            onTextSettled={onTextSettled}
          />
        ))}
      </Canvas>
    </TransportContext.Provider>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas">
      <p className="text-sm text-ink-secondary">{text}</p>
    </div>
  )
}
