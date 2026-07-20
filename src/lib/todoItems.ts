import * as Y from 'yjs'

import type { TodoItem } from '../types/db'
import { LOCAL_ORIGIN } from './yOrigins'

export const ITEMS_KEY = 'items'

/**
 * A todo item inside the doc is a Y.Map { id: string, done: boolean,
 * text: Y.Text }. Item text is a Y.Text so concurrent edits inside one item
 * merge per character, same as a note body — CLAUDE.md rule 1 names todo
 * explicitly.
 */
export type ItemMap = Y.Map<unknown>

export function itemsOf(doc: Y.Doc): Y.Array<ItemMap> {
  return doc.getArray<ItemMap>(ITEMS_KEY)
}

export function itemText(item: ItemMap): Y.Text | null {
  const text = item.get('text')
  return text instanceof Y.Text ? text : null
}

export function itemId(item: ItemMap): string {
  const id = item.get('id')
  return typeof id === 'string' ? id : ''
}

export function itemDone(item: ItemMap): boolean {
  return item.get('done') === true
}

function buildItem(seed?: Partial<TodoItem>): ItemMap {
  const map = new Y.Map<unknown>()
  map.set('id', seed?.id ?? crypto.randomUUID())
  map.set('done', seed?.done ?? false)
  const text = new Y.Text()
  if (seed?.text) text.insert(0, seed.text)
  map.set('text', text)
  return map
}

/** Insert a new empty item at `index` (defaults to the end). */
export function addItem(doc: Y.Doc, index?: number): void {
  const items = itemsOf(doc)
  doc.transact(() => {
    items.insert(index ?? items.length, [buildItem()])
  }, LOCAL_ORIGIN)
}

export function removeItem(doc: Y.Doc, index: number): void {
  const items = itemsOf(doc)
  if (index < 0 || index >= items.length) return
  doc.transact(() => items.delete(index, 1), LOCAL_ORIGIN)
}

export function toggleItem(doc: Y.Doc, index: number): void {
  const items = itemsOf(doc)
  const item = items.get(index)
  if (!item) return
  doc.transact(() => item.set('done', !itemDone(item)), LOCAL_ORIGIN)
}

/** Used once, to seed a doc from the plain jsonb copy when no ydoc exists yet. */
export function seedItems(doc: Y.Doc, seeds: TodoItem[]): void {
  const items = itemsOf(doc)
  doc.transact(() => {
    items.insert(0, seeds.map((s) => buildItem(s)))
  }, LOCAL_ORIGIN)
}

/** Plain snapshot for the jsonb `content` column — search and list view read this. */
export function itemsToPlain(doc: Y.Doc): TodoItem[] {
  const out: TodoItem[] = []
  itemsOf(doc).forEach((item) => {
    out.push({
      id: itemId(item),
      done: itemDone(item),
      text: itemText(item)?.toString() ?? '',
    })
  })
  return out
}
