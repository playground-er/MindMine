import type { LucideIcon, LucideProps } from 'lucide-react'

interface IconProps extends Omit<LucideProps, 'ref'> {
  icon: LucideIcon
}

/**
 * Single entry point for every icon in the app.
 *
 * Lucide has no context provider, so the 1.5px stroke from the spec is applied
 * here rather than repeated at each call site. Importing a lucide icon
 * directly bypasses this — always go through <Icon />.
 */
export function Icon({ icon: Glyph, size = 18, ...props }: IconProps) {
  // strokeWidth sits after the spread on purpose: 1.5 is a rule, not a default.
  return <Glyph size={size} {...props} strokeWidth={1.5} />
}
