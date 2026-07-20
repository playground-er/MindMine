import { memo, useEffect, useState } from 'react'

import { cursorColor } from '../lib/cursorColor'
import { useCanvasStore } from '../store/canvasStore'
import { usePresenceStore, type PeerCursor } from '../store/presenceStore'
import type { Member } from '../types/db'

/** PRD section 3: more than this on screen is noise, not information. */
const MAX_CURSORS = 8
/** Name tag shows on arrival, then gets out of the way. */
const LABEL_VISIBLE_MS = 1500

function CursorGlyph({ color }: { color: string }) {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
      <path
        d="M1 1L12.5 9.2L7.2 10.1L4.6 15.6L1 1Z"
        fill={color}
        stroke="var(--surface)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PeerCursorView({ peer, name, zoom }: { peer: PeerCursor; name: string; zoom: number }) {
  const [showLabel, setShowLabel] = useState(true)

  useEffect(() => {
    setShowLabel(true)
    const timer = window.setTimeout(() => setShowLabel(false), LABEL_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [peer.memberId])

  const color = cursorColor(peer.memberId)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0"
      style={{
        // Counter-scaling keeps the cursor a constant size on screen while
        // still riding the world layer's transform, so panning stays free.
        transform: `translate3d(${peer.x}px, ${peer.y}px, 0) scale(${1 / zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <CursorGlyph color={color} />
      <span
        className="absolute left-[14px] top-[14px] whitespace-nowrap rounded-sm px-[6px] py-[2px] text-2xs text-white transition-opacity duration-[200ms]"
        style={{ background: color, opacity: showLabel ? 1 : 0 }}
      >
        {name}
      </span>
    </div>
  )
}

interface Props {
  members: Map<string, Member>
}

/**
 * Peer cursors, drawn inside the world layer.
 *
 * Subscribes to `peers` only. Cards subscribe to neither this store nor these
 * props, which is what keeps a moving cursor from re-rendering the board.
 */
function PresenceLayerImpl({ members }: Props) {
  const peers = usePresenceStore((s) => s.peers)
  const zoom = useCanvasStore((s) => s.viewport.zoom)
  const viewport = useCanvasStore.getState().viewport

  // Nearest to the middle of the screen wins the visible slots.
  const centerX = (window.innerWidth / 2 - viewport.x) / zoom
  const centerY = (window.innerHeight / 2 - viewport.y) / zoom

  const visible = Object.values(peers)
    .sort((a, b) => {
      const da = (a.x - centerX) ** 2 + (a.y - centerY) ** 2
      const db = (b.x - centerX) ** 2 + (b.y - centerY) ** 2
      return da - db
    })
    .slice(0, MAX_CURSORS)

  return (
    <>
      {visible.map((peer) => (
        <PeerCursorView
          key={peer.memberId}
          peer={peer}
          name={members.get(peer.memberId)?.name ?? 'Seseorang'}
          zoom={zoom}
        />
      ))}
    </>
  )
}

export const PresenceLayer = memo(PresenceLayerImpl)
