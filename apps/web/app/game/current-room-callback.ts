/** Restrict a callback to its currently attached connection. */
export function currentRoomCallback<Args extends unknown[]>(
  isCurrent: () => boolean,
  callback: (...args: Args) => void
): (...args: Args) => void {
  return (...args) => { if (isCurrent()) callback(...args) }
}
