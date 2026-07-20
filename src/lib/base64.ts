/**
 * Yjs updates are binary; Supabase broadcast payloads are JSON. Base64 is the
 * crossing point. Chunked to stay clear of the argument limit on
 * String.fromCharCode for large documents.
 */

const CHUNK = 0x8000

export function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
