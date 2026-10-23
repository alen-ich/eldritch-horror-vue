export function createLatestConnectionRequest() {
  let latest = 0
  return {
    async run<T>(connect: () => Promise<T>, accept: (value: T) => void, reject: (error: unknown) => void, discard: (value: T) => void | Promise<unknown>): Promise<boolean> {
      const request = ++latest
      try {
        const value = await connect()
        if (request !== latest) {
          // Cleanup must never publish an obsolete error or block newer requests.
          try { void Promise.resolve(discard(value)).catch(() => {}) } catch { /* Best effort. */ }
          return false
        }
        accept(value)
        return true
      } catch (error) {
        if (request === latest) reject(error)
        return false
      }
    }
  }
}
