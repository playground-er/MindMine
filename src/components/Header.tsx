import { usePresenceStore } from '../store/presenceStore'
import type { Member } from '../types/db'
import { AvatarStack } from './AvatarStack'

interface Props {
  title: string
  members: Map<string, Member>
}

/**
 * 48px, translucent with a blur so the dot grid stays faintly visible through
 * it while panning. That is what makes it read as a layer over the canvas
 * rather than a bar bolted to the top (DESIGN-SPEC section 9).
 */
export function Header({ title, members }: Props) {
  const online = usePresenceStore((s) => s.online)
  const isOffline = usePresenceStore((s) => s.isOffline)

  const present = online.map((id) => members.get(id)).filter((m): m is Member => Boolean(m))

  return (
    <header className="absolute inset-x-0 top-0 z-10">
      <div
        className="flex h-12 items-center justify-between px-4"
        style={{
          background: 'rgba(255,254,251,0.82)',
          backdropFilter: 'blur(12px)',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        {/* Serif is deliberately not used here: at 15px it adds nothing. */}
        <span className="text-title-card text-ink">{title}</span>
        <AvatarStack members={present} />
      </div>

      {isOffline && (
        <div
          role="status"
          className="px-4 py-[6px] text-2xs text-ink-secondary"
          style={{ background: 'var(--surface-inset)' }}
        >
          Sedang offline. Perubahan tetap tersimpan dan akan disinkronkan saat koneksi kembali.
        </div>
      )}
    </header>
  )
}
