/**
 * Transaction origin markers, kept in their own module.
 *
 * They are shared by the registry, the transport and the diff helper. Putting
 * them beside the registry meant importing y-indexeddb — and with it a hard
 * dependency on IndexedDB — just to read two constants.
 */

/**
 * Marks transactions that originated in this tab. Y.UndoManager tracks only
 * this origin, which is what makes ⌘Z per-user rather than global: undoing
 * someone else's sentence because it happened to be the most recent edit is
 * the single most confusing thing a shared editor can do.
 */
export const LOCAL_ORIGIN = Symbol('mindmine-local')

/** Applied to remote transactions so they are not echoed back out. */
export const REMOTE_ORIGIN = 'remote'
