export function replaceAttachedRoom<T>(previous: T | undefined, next: T, publish: (value: T) => void, discard: (value: T) => void | Promise<unknown>): void {
  publish(next)
  if (previous === undefined || previous === next) return
  // Old callbacks must already see the new identity; cleanup cannot block it.
  try { void Promise.resolve(discard(previous)).catch(() => {}) } catch { /* Best effort. */ }
}
