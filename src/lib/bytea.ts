/**
 * Postgres `bytea` over PostgREST travels as a hex string prefixed with `\x`.
 * Yjs hands us Uint8Array, so both directions need converting by hand — there
 * is no binary column type in the JSON the client actually sends.
 */

export function toBytea(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return `\\x${hex}`
}

export function fromBytea(value: string | null): Uint8Array | null {
  if (!value) return null

  const hex = value.startsWith('\\x') ? value.slice(2) : value
  if (hex.length === 0) return null
  if (hex.length % 2 !== 0) return null

  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i] = byte
  }
  return bytes
}
