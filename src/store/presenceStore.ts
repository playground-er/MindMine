import { create } from 'zustand'

export interface PeerCursor {
  memberId: string
  /** World coordinates, so a peer's cursor lands correctly at any zoom. */
  x: number
  y: number
  editingCardId: string | null
  selectedCardId: string | null
  updatedAt: number
}

interface PresenceState {
  peers: Record<string, PeerCursor>
  /** Members currently subscribed to the board, cursor or not. */
  online: string[]
  isOffline: boolean

  applyPeer: (peer: PeerCursor) => void
  dropPeer: (memberId: string) => void
  setOnline: (ids: string[]) => void
  setOffline: (isOffline: boolean) => void
  reset: () => void
}

/**
 * Presence lives in its own store, deliberately.
 *
 * PRD section 11 is explicit that a peer moving their cursor must not re-render
 * cards. Sharing a store with card state would do exactly that, because any
 * subscriber to the store object re-runs on every write — sixty times a second
 * per peer.
 */
export const usePresenceStore = create<PresenceState>((set) => ({
  peers: {},
  online: [],
  isOffline: false,

  applyPeer: (peer) => set((s) => ({ peers: { ...s.peers, [peer.memberId]: peer } })),

  dropPeer: (memberId) =>
    set((s) => {
      if (!(memberId in s.peers)) return s
      const next = { ...s.peers }
      delete next[memberId]
      return { peers: next }
    }),

  setOnline: (online) => set({ online }),
  setOffline: (isOffline) => set({ isOffline }),
  reset: () => set({ peers: {}, online: [] }),
}))
