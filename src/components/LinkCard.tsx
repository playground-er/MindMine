import { ExternalLink, Link2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'

import { ACCENTS } from '../lib/accents'
import { fetchLinkMeta, isProbablyUrl } from '../lib/linkMeta'
import { useBoardStore } from '../store/boardStore'
import { isLinkContent, type LinkContent } from '../types/db'
import { CardShell, cardPropsEqual } from './CardShell'
import { Icon } from './Icon'
import type { CardTypeProps } from './NoteCard'

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function LinkCardImpl({
  card,
  authorName,
  isSelected,
  isEditing,
  peerEditors,
  isCompact,
  onCommitGeometry,
  onContentChange,
}: CardTypeProps) {
  const content: LinkContent = isLinkContent(card.content) ? card.content : { url: '' }
  const endEdit = useBoardStore((s) => s.endEdit)

  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(content.url)

  const needsUrl = content.url.length === 0
  const editingUrl = isEditing || needsUrl

  useEffect(() => {
    if (editingUrl) inputRef.current?.focus()
  }, [editingUrl])

  const submit = async () => {
    const url = draft.trim()
    endEdit()
    if (!url || url === content.url) return
    if (!isProbablyUrl(url)) {
      // Not an error card — keep whatever was typed as the raw URL.
      onContentChange(card.id, { url, title: url })
      return
    }
    // Show the card immediately with the hostname; upgrade when metadata lands.
    onContentChange(card.id, { url, title: hostnameOf(url) })
    const meta = await fetchLinkMeta(url)
    onContentChange(card.id, meta)
  }

  const title = content.title || (content.url ? hostnameOf(content.url) : '')

  return (
    <CardShell
      card={card}
      accent={ACCENTS.link}
      icon={Link2}
      ariaLabel={title || 'Tautan'}
      authorName={authorName}
      isSelected={isSelected}
      isEditing={isEditing}
      isCompact={isCompact}
      peerEditors={peerEditors}
      onCommitGeometry={onCommitGeometry}
      title={
        editingUrl ? (
          <span className="text-title-card text-ink-tertiary">Tautan</span>
        ) : (
          <span className="truncate text-title-card text-ink">
            {title || <span className="text-ink-tertiary">Tautan</span>}
          </span>
        )
      }
    >
      {editingUrl ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') void submit()
            if (e.key === 'Escape') endEdit()
          }}
          onBlur={() => void submit()}
          placeholder="https://…"
          className="mt-3 w-full rounded-sm bg-surface-inset px-2 py-[6px] text-sm text-ink outline-none placeholder:text-ink-tertiary"
        />
      ) : (
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          // A plain click selects/drags the card; opening is an explicit action
          // on this row only.
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-3 flex items-center gap-2 text-2xs text-ink-secondary hover:text-ink"
        >
          {content.favicon && (
            <img src={content.favicon} alt="" width={16} height={16} className="rounded-[3px]" />
          )}
          <span className="truncate">{hostnameOf(content.url)}</span>
          <Icon icon={ExternalLink} size={12} className="shrink-0" />
        </a>
      )}
    </CardShell>
  )
}

export const LinkCard = memo(LinkCardImpl, cardPropsEqual)
