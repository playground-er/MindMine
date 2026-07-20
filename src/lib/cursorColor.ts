/**
 * Cursor identity colours.
 *
 * DESIGN-SPEC section 9 requires "12 warna, deterministik dari hash user id"
 * and insists this system stays separate from the card accent palette — accent
 * means card type, cursor means person, and sharing values would blur both.
 * It does not list the twelve values, so these are chosen here:
 *
 *   - Evenly spaced hues, so neighbouring assignments never look alike.
 *   - Mid lightness (~52%), which keeps every one of them legible on both
 *     --canvas #f5f1e9 and dark #1a1917 without a per-theme table.
 *   - More saturated than any accent, because a cursor has to be found in
 *     peripheral vision while accents must stay quiet under text.
 */
const CURSOR_PALETTE = [
  '#d1495b',
  '#e07a3f',
  '#c9992b',
  '#8aa62f',
  '#4c9a52',
  '#2f9e8f',
  '#2b8fae',
  '#3f74c4',
  '#6a5fc7',
  '#9350b8',
  '#c14d97',
  '#b5566b',
] as const

/** FNV-1a. Small, stable across sessions and machines — which is the point. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function cursorColor(memberId: string): string {
  return CURSOR_PALETTE[hash(memberId) % CURSOR_PALETTE.length]!
}
