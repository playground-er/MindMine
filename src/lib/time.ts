const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Card meta is glanceable, not precise — coarse buckets are the point. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))

  if (seconds < 45) return 'baru saja'
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} menit lalu`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} jam lalu`
  if (seconds < 30 * DAY) return `${Math.floor(seconds / DAY)} hari lalu`

  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
