import { createContext, useContext } from 'react'

import type { YDocTransport } from './ydocTransport'

/**
 * One transport per board, owned by BoardView. Cards reach it through context
 * rather than props so that viewport culling in Tahap 4 can mount and unmount
 * them freely without rethreading the plumbing.
 */
export const TransportContext = createContext<YDocTransport | null>(null)

export function useTransport(): YDocTransport | null {
  return useContext(TransportContext)
}
