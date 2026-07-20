interface Props {
  message: string
  actionLabel: string
  onAction: () => void
}

/**
 * Single-slot toast. The undo window is the safety net for ⌫ (5s); after that
 * the card is still recoverable for 30 days via soft delete.
 */
export function Toast({ message, actionLabel, onAction }: Props) {
  return (
    <div
      role="status"
      className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-inset px-4 py-[10px] shadow-float"
      style={{ background: 'var(--surface)' }}
    >
      <span className="text-sm text-ink">{message}</span>
      <button
        type="button"
        onClick={onAction}
        className="text-label text-[var(--accent-note-ink)] underline underline-offset-4"
      >
        {actionLabel}
      </button>
    </div>
  )
}
