import { getSupabase } from '../lib/supabase'

const BUCKET = 'card-images'

/** Signed URLs are valid this long; the cache renews them slightly earlier. */
const SIGN_TTL_S = 60 * 60

export interface UploadedImage {
  path: string
  natural_w: number
  natural_h: number
}

/** Reads intrinsic dimensions, uploads, and returns the storage path. */
export async function uploadCardImage(file: File): Promise<UploadedImage> {
  const bitmap = await createImageBitmap(file)
  const natural_w = bitmap.width
  const natural_h = bitmap.height
  bitmap.close()

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await getSupabase().storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/png',
    cacheControl: '3600',
  })
  if (error) throw error

  return { path, natural_w, natural_h }
}

interface SignedEntry {
  url: string
  expiresAt: number
}

const signedCache = new Map<string, SignedEntry>()

/**
 * Resolves a storage path to a viewable URL.
 *
 * The bucket is private on purpose — reads go through the same is_member()
 * RLS as everything else, so a leaked URL dies with its signature instead of
 * living forever. That rules out getPublicUrl; every render session signs the
 * paths it actually shows, cached until shortly before expiry.
 */
export async function resolveImageUrl(path: string): Promise<string> {
  // Cards written against a public bucket (or seeded by hand) may hold a full URL.
  if (/^https?:\/\//i.test(path)) return path

  const cached = signedCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGN_TTL_S)
  if (error) throw error

  signedCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGN_TTL_S - 60) * 1000,
  })
  return data.signedUrl
}
