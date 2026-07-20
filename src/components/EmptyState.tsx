/**
 * One of only two places serif is used, and the only one on the canvas.
 * At 34px the stroke contrast actually reads — below 26px it would not.
 * No illustration, no button: the instruction is the whole affordance.
 */
export function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <p className="font-display text-title-empty text-ink-secondary">
        Klik dua kali di mana saja untuk mulai.
      </p>
    </div>
  )
}
