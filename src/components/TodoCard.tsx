import { CircleCheck, Plus, X } from 'lucide-react'
import { memo, useEffect, useReducer, useRef } from 'react'
import * as Y from 'yjs'

import { useDocFlush } from '../hooks/useDocFlush'
import { useYText } from '../hooks/useYText'
import { ACCENTS } from '../lib/accents'
import { fromBytea } from '../lib/bytea'
import { applyStringDiff } from '../lib/textDiff'
import { addItem, itemsOf, itemsToPlain, itemText, removeItem, toggleItem } from '../lib/todoItems'
import { TEXT_KEY } from '../lib/ydocRegistry'
import { useBoardStore } from '../store/boardStore'
import { isTodoContent } from '../types/db'
import { CardShell, cardPropsEqual } from './CardShell'
import { Icon } from './Icon'
import type { CardTypeProps } from './NoteCard'

/**
 * The one place the icon system allows a 2px stroke: DESIGN-SPEC section 8
 * specifies the checkbox tick as white 2px explicitly. Inline SVG rather than
 * a lucide icon so the exception stays local and obvious.
 */
function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
      <path
        d="M3 8.5L6.5 12L13 4.5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TodoCardImpl({
  card,
  authorName,
  isSelected,
  isEditing,
  peerEditors,
  isCompact,
  onCommitGeometry,
  onDocSettled,
}: CardTypeProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const endEdit = useBoardStore((s) => s.endEdit)

  const seed = isTodoContent(card.content)
    ? { text: card.content.title, items: card.content.items }
    : { text: '', items: [] }

  const { value: title, setValue: setTitle, undoManager, doc } = useYText(
    card.id,
    seed,
    fromBytea(card.ydoc),
    titleRef,
  )

  useDocFlush(
    doc,
    card.id,
    () => ({ title: doc.getText(TEXT_KEY).toString(), items: itemsToPlain(doc) }),
    onDocSettled,
  )

  /**
   * Item edits re-render through a version bump instead of copying the array
   * into React state — the Y.Array is the state, and observeDeep fires for
   * both local and remote changes, including nested item text.
   */
  const [, bump] = useReducer((v: number) => v + 1, 0)
  useEffect(() => {
    const items = itemsOf(doc)
    const observer = () => bump()
    items.observeDeep(observer)
    return () => items.unobserveDeep(observer)
  }, [doc])

  useEffect(() => {
    if (isEditing) titleRef.current?.focus()
  }, [isEditing])

  const plain = itemsToPlain(doc)
  const doneCount = plain.filter((i) => i.done).length

  const stopKeys = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) undoManager.redo()
      else undoManager.undo()
    }
  }

  return (
    <CardShell
      card={card}
      accent={ACCENTS.todo}
      icon={CircleCheck}
      ariaLabel={title || 'Todo'}
      authorName={authorName}
      isSelected={isSelected}
      isEditing={isEditing}
      isCompact={isCompact}
      peerEditors={peerEditors}
      onCommitGeometry={onCommitGeometry}
      title={
        isEditing ? (
          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
            onKeyDown={(e) => {
              stopKeys(e)
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                if (e.key === 'Escape') endEdit()
                else titleRef.current?.blur()
              }
            }}
            className="w-full resize-none bg-transparent text-title-card text-ink outline-none placeholder:text-ink-tertiary"
            placeholder="Judul todo"
          />
        ) : (
          <span className="truncate text-title-card text-ink">
            {title || <span className="text-ink-tertiary">Todo</span>}
          </span>
        )
      }
    >
      {/* Inset block: L2 surface, 7px radius, no shadow — it goes down, not up. */}
      <section
        aria-label="Daftar item"
        className="mt-3 rounded-inset bg-surface-inset px-[14px] py-3"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-label text-ink">Item</span>
          <span className="text-2xs text-ink-tertiary">
            {doneCount}/{plain.length}
          </span>
        </div>

        {plain.map((item, index) => (
          <TodoItemRow
            key={item.id || index}
            doc={doc}
            index={index}
            done={item.done}
            text={item.text}
            onKeyDown={stopKeys}
          />
        ))}

        <button
          type="button"
          onClick={() => addItem(doc)}
          className="-mx-[6px] mt-1 flex w-[calc(100%+12px)] items-center gap-2 rounded-sm px-[6px] py-1 text-sm text-ink-tertiary transition-colors duration-[120ms] hover:bg-[rgba(0,0,0,0.02)] hover:text-ink-secondary"
        >
          <Icon icon={Plus} size={14} />
          Tambah item
        </button>
      </section>
    </CardShell>
  )
}

interface RowProps {
  doc: Y.Doc
  index: number
  done: boolean
  text: string
  onKeyDown: (e: React.KeyboardEvent) => void
}

function TodoItemRow({ doc, index, done, text, onKeyDown }: RowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const setText = (next: string) => {
    const item = itemsOf(doc).get(index)
    const ytext = item ? itemText(item) : null
    if (ytext) applyStringDiff(ytext, next)
  }

  return (
    // Row hover extends 6px past the block padding, per the spec's item rules.
    <div className="group -mx-[6px] flex items-center gap-2 rounded-sm px-[6px] py-1 hover:bg-[rgba(0,0,0,0.02)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Tandai belum selesai' : 'Tandai selesai'}
        onClick={() => toggleItem(doc, index)}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-sm transition-colors duration-[120ms]"
        style={{
          border: done ? 'none' : '1.5px solid var(--border-strong)',
          background: done ? 'var(--accent-todo-ink)' : 'transparent',
        }}
      >
        {done && <Tick />}
      </button>

      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown(e)
          if (e.key === 'Enter') {
            e.preventDefault()
            addItem(doc, index + 1)
          }
          if (e.key === 'Backspace' && text.length === 0) {
            e.preventDefault()
            removeItem(doc, index)
          }
        }}
        placeholder="Item baru"
        className={`w-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-tertiary ${
          done ? 'text-ink-muted line-through' : 'text-ink'
        }`}
      />

      <button
        type="button"
        aria-label="Hapus item"
        onClick={() => removeItem(doc, index)}
        className="shrink-0 text-ink-tertiary opacity-0 transition-opacity duration-[120ms] hover:text-ink group-hover:opacity-100"
      >
        <Icon icon={X} size={14} />
      </button>
    </div>
  )
}

export const TodoCard = memo(TodoCardImpl, cardPropsEqual)
