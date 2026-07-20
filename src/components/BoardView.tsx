import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchOrCreateRootBoard } from '../api/board'
import {
  createCard,
  flushCardDoc,
  listCards,
  restoreCard,
  softDeleteCard,
  updateCardContent,
  updateCardGeometry,
} from '../api/cards'
import { listMembers } from '../api/members'
import { uploadCardImage } from '../api/storage'
import { usePresence } from '../hooks/usePresence'
import { useRealtimeCards } from '../hooks/useRealtimeCards'
import { useVisibleCards } from '../hooks/useVisibleCards'
import { screenToWorld, snap } from '../lib/geometry'
import { fetchLinkMeta, isProbablyUrl } from '../lib/linkMeta'
import { TransportContext } from '../lib/transportContext'
import { YDocTransport } from '../lib/ydocTransport'
import { useBoardStore } from '../store/boardStore'
import { useCanvasStore } from '../store/canvasStore'
import { usePresenceStore } from '../store/presenceStore'
import type { Point } from '../types/canvas'
import type { Card, CardType, Member } from '../types/db'
import { Canvas } from './Canvas'
import { CardView } from './CardView'
import { EmptyState } from './EmptyState'
import { FloatingNavbar } from './FloatingNavbar'
import { Header } from './Header'
import { PresenceLayer } from './PresenceLayer'
import { Toast } from './Toast'

const UNDO_WINDOW_MS = 5000

/** Module scope so cards without peer editors keep a stable prop identity. */
const NO_EDITORS: Member[] = []

/** Fresh content per type. Todo starts with one empty item as the invitation. */
function initialContent(type: CardType): Card['content'] {
  switch (type) {
    case 'note':
      return { text: '' }
    case 'todo':
      return { title: '', items: [{ id: crypto.randomUUID(), text: '', done: false }] }
    case 'link':
      return { url: '' }
    default:
      return {}
  }
}

export function BoardView({ member }: { member: Member }) {
  const queryClient = useQueryClient()
  const [pendingUndo, setPendingUndo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  /** Navbar- and paste-created cards land in the middle of what you see. */
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
    mutationFn: (input: { type: CardType; world: Point; content: Card['content']; w?: number }) =>
      createCard({
        boardId: boardId!,
        memberId: member.id,
        type: input.type,
        x: snap(input.world.x, true),
        y: snap(input.world.y, true),
        z: (cardsQuery.data?.length ?? 0) + 1,
        w: input.w,
        content: input.content,
      }),
    onSuccess: (card) => {
      queryClient.setQueryData<Card[]>(cardsKey, (prev) => [...(prev ?? []), card])
      // Image has no edit mode; dropping straight into edit fits the rest.
      if (card.type !== 'image') beginEdit(card.id)
    },
  })

  const geometryMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: { x: number; y: number; w: number } }) =>
      updateCardGeometry(id, next, member.id),
    onError: () => void queryClient.invalidateQueries({ queryKey: cardsKey }),
  })

  const flushMutation = useMutation({
    mutationFn: ({ id, content, ydocHex }: { id: string; content: Card['content']; ydocHex: string }) =>
      flushCardDoc(id, ydocHex, content, member.id),
  })

  const contentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: Card['content'] }) =>
      updateCardContent(id, content, member.id),
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

  /** Reads dimensions, uploads to the private bucket, then creates the card. */
  const createImageFromFile = useCallback(
    async (file: File, world: Point) => {
      const uploaded = await uploadCardImage(file)
      createMutation.mutate({
        type: 'image',
        world,
        w: 320,
        content: {
          url: uploaded.path,
          alt: file.name.replace(/\.[^.]+$/, ''),
          natural_w: uploaded.natural_w,
          natural_h: uploaded.natural_h,
        },
      })
    },
    [createMutation],
  )

  /** Navbar entry point. */
  const handleCreate = useCallback(
    (type: CardType) => {
      if (type === 'image') {
        fileInputRef.current?.click()
        return
      }
      createMutation.mutate({ type, world: viewportCenterWorld(), content: initialContent(type) })
    },
    [createMutation, viewportCenterWorld],
  )

  /**
   * Canvas paste: image file → image card, URL → link card (metadata resolved
   * after the card exists — never an error card), any other text → note.
   */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (useBoardStore.getState().editingId) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')
      ) {
        return
      }

      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        void createImageFromFile(file, viewportCenterWorld())
        return
      }

      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (!text) return
      e.preventDefault()

      if (isProbablyUrl(text)) {
        createMutation.mutate(
          { type: 'link', world: viewportCenterWorld(), content: { url: text } },
          {
            onSuccess: (card) => {
              void fetchLinkMeta(text).then((meta) => {
                patchCache(card.id, { content: meta })
                contentMutation.mutate({ id: card.id, content: meta })
              })
            },
          },
        )
        return
      }

      createMutation.mutate({ type: 'note', world: viewportCenterWorld(), content: { text } })
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [createMutation, contentMutation, createImageFromFile, patchCache, viewportCenterWorld])

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
        (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')
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
   * inside each card. Reading the presence store from a card would couple
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

  const onDocSettled = useCallback(
    (id: string, content: Card['content'], ydocHex: string) => {
      patchCache(id, { content })
      flushMutation.mutate({ id, content, ydocHex })
    },
    [patchCache, flushMutation],
  )

  const onContentChange = useCallback(
    (id: string, content: Card['content']) => {
      patchCache(id, { content })
      contentMutation.mutate({ id, content })
    },
    [patchCache, contentMutation],
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
        onCreateAt={(world) => createMutation.mutate({ type: 'note', world, content: { text: '' } })}
        onBackgroundClick={() => select(null)}
        worldOverlay={<PresenceLayer members={memberMap} />}
        overlay={
          <>
            <Header title={boardQuery.data?.title ?? 'MindMine'} members={memberMap} />
            <FloatingNavbar onCreate={handleCreate} />
            {cards.length === 0 && <EmptyState />}
            {pendingUndo && (
              <Toast
                message="Kartu dihapus."
                actionLabel="Urungkan"
                onAction={() => restoreMutation.mutate(pendingUndo)}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void createImageFromFile(file, viewportCenterWorld())
              }}
            />
          </>
        }
      >
        {visibleCards.map((card) => (
          <CardView
            key={card.id}
            card={card}
            isCompact={isCompact}
            authorName={memberMap.get(card.updated_by)?.name ?? '—'}
            isSelected={selectedId === card.id}
            isEditing={editingId === card.id}
            peerEditors={editorsByCard.get(card.id) ?? NO_EDITORS}
            onCommitGeometry={commitGeometry}
            onDocSettled={onDocSettled}
            onContentChange={onContentChange}
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
