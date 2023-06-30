export function panic(message?: string): never {
  throw new Error(message)
}

declare global {
  interface Promise<T> {
    swallow(err?: unknown): Promise<T | undefined>
  }
}

Promise.prototype.swallow = function(gristle?: (e: unknown) => boolean) {
  return this.catch((err: unknown) => {
    if (gristle && !gristle(err)) {
      throw err
    }
  })
}
