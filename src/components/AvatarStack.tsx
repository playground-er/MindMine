import { cursorColor } from '../lib/cursorColor'
import type { Member } from '../types/db'

interface Props {
  members: Member[]
  size?: number
  max?: number
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? '?'
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : undefined
  return (first + (second ?? '')).toUpperCase()
}

/**
 * Overlapping avatars, capped with a +N.
 *
 * The ring is a box-shadow rather than a border: a border grows the box, so
 * the -7px overlap from DESIGN-SPEC section 9 would drift wider with every
 * avatar. A shadow paints outside the box and leaves the geometry alone.
 */
export function AvatarStack({ members, size = 24, max = 4 }: Props) {
  const shown = members.slice(0, max)
  const overflow = members.length - shown.length

  return (
    <div className="flex items-center" aria-label={`${members.length} orang di board ini`}>
      {shown.map((member, index) => (
        <div
          key={member.id}
          title={member.name}
          className="grid shrink-0 place-items-center rounded-full bg-surface-inset font-semibold"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.4,
            color: cursorColor(member.id),
            marginLeft: index === 0 ? 0 : -7,
            boxShadow: '0 0 0 2px var(--surface)',
            zIndex: shown.length - index,
          }}
        >
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            initials(member.name)
          )}
        </div>
      ))}

      {overflow > 0 && (
        <div
          className="grid shrink-0 place-items-center rounded-full bg-surface-inset text-ink-secondary"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.36,
            marginLeft: -7,
            boxShadow: '0 0 0 2px var(--surface)',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
