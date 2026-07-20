/** Canvas viewport transform. Screen = world * zoom + offset. */
export interface Viewport {
  /** Horizontal pan in screen pixels. */
  x: number
  /** Vertical pan in screen pixels. */
  y: number
  /** Scale factor, clamped to ZOOM_MIN..ZOOM_MAX. */
  zoom: number
}

export interface Point {
  x: number
  y: number
}
