import { Image as ImageIcon } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

import { resolveImageUrl } from '../api/storage'
import { ACCENTS } from '../lib/accents'
import { isImageContent, type ImageContent } from '../types/db'
import { CardShell, cardPropsEqual } from './CardShell'
import type { CardTypeProps } from './NoteCard'

type LoadState = 'loading' | 'ready' | 'failed'

function ImageCardImpl({
  card,
  authorName,
  isSelected,
  isEditing,
  peerEditors,
  isCompact,
  onCommitGeometry,
}: CardTypeProps) {
  const content: ImageContent | null = isImageContent(card.content) ? card.content : null

  const [src, setSrc] = useState<string | null>(null)
  const [state, setState] = useState<LoadState>('loading')

  // The bucket is private; the stored value is a path that gets signed per
  // session. See resolveImageUrl.
  useEffect(() => {
    if (!content?.url) return
    let active = true
    setState('loading')
    resolveImageUrl(content.url)
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => {
        if (active) setState('failed')
      })
    return () => {
      active = false
    }
  }, [content?.url])

  // Reserve the correct height before a single byte arrives, so the layout
  // never jumps when the image lands (PRD section 9).
  const ratio = content && content.natural_w > 0 ? content.natural_h / content.natural_w : 0.66
  const bodyW = card.w - 38 // card padding: 18px each side + 2px strip
  const bodyH = Math.round(bodyW * ratio)

  return (
    <CardShell
      card={card}
      accent={ACCENTS.image}
      icon={ImageIcon}
      ariaLabel={content?.alt || 'Gambar'}
      authorName={authorName}
      isSelected={isSelected}
      isEditing={isEditing}
      isCompact={isCompact}
      peerEditors={peerEditors}
      onCommitGeometry={onCommitGeometry}
      title={
        <span className="truncate text-title-card text-ink">
          {content?.alt || <span className="text-ink-tertiary">Gambar</span>}
        </span>
      }
    >
      <div
        className="mt-3 overflow-hidden rounded-inset bg-surface-inset"
        style={{ width: bodyW, height: bodyH }}
      >
        {state === 'failed' ? (
          <div className="grid h-full w-full place-items-center text-2xs text-ink-tertiary">
            Gambar tidak bisa dimuat
          </div>
        ) : (
          <>
            {state === 'loading' && (
              <div className="h-full w-full animate-[card-shimmer_1.4s_ease-in-out_infinite_alternate] bg-surface-inset" />
            )}
            {src && (
              <img
                src={src}
                alt={content?.alt ?? ''}
                onLoad={() => setState('ready')}
                onError={() => setState('failed')}
                draggable={false}
                className="h-full w-full select-none object-cover"
                style={{ display: state === 'ready' ? 'block' : 'none' }}
              />
            )}
          </>
        )}
      </div>
    </CardShell>
  )
}

export const ImageCard = memo(ImageCardImpl, cardPropsEqual)
