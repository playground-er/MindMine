import { create } from 'zustand'

interface BoardState {
  selectedId: string | null
  editingId: string | null
  /** Set while a card is being dragged, so the canvas ignores its own pan. */
  draggingId: string | null

  select: (id: string | null) => void
  beginEdit: (id: string) => void
  endEdit: () => void
  setDragging: (id: string | null) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  selectedId: null,
  editingId: null,
  draggingId: null,

  select: (id) => set((s) => ({ selectedId: id, editingId: s.editingId === id ? id : null })),
  beginEdit: (id) => set({ editingId: id, selectedId: id }),
  endEdit: () => set({ editingId: null }),
  setDragging: (id) => set({ draggingId: id }),
}))
