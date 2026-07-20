import * as Y from 'yjs'

import { LOCAL_ORIGIN } from './yOrigins'

/**
 * Rewrites a Y.Text to `next` using the smallest edit that explains it.
 *
 * A textarea only reports its full value. Sending "delete everything, insert
 * everything" to Yjs would make two people typing in the same card clobber
 * each other on every keystroke — the exact failure CRDTs exist to prevent.
 * Trimming the shared prefix and suffix leaves only what actually changed, so
 * concurrent edits in different parts of the text merge instead of collide.
 */
export function applyStringDiff(text: Y.Text, next: string): void {
  const current = text.toString()
  if (current === next) return

  let prefix = 0
  const maxPrefix = Math.min(current.length, next.length)
  while (prefix < maxPrefix && current[prefix] === next[prefix]) prefix++

  let suffix = 0
  const maxSuffix = Math.min(current.length - prefix, next.length - prefix)
  while (
    suffix < maxSuffix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }

  const removed = current.length - prefix - suffix
  const inserted = next.slice(prefix, next.length - suffix)

  text.doc?.transact(() => {
    if (removed > 0) text.delete(prefix, removed)
    if (inserted.length > 0) text.insert(prefix, inserted)
  }, LOCAL_ORIGIN)
}
