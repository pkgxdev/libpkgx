// deno-lint-ignore-file no-explicit-any

export function panic(message?: string): never {
  throw new Error(message)
}

declare global {
  interface Promise<T> {
    swallow(errorClass?: new (...args: any) => any): Promise<T | undefined>
  }
}

Promise.prototype.swallow = function (errorClass?: new (...args: any) => any) {
  return this.catch((err: unknown) => {
    if (errorClass && !(err instanceof errorClass)) {
      throw err
    }
  })
}

export class TeaError extends Error {
  ctx: any
  constructor(msg: string, ctx?: any) {
    super(msg)
    this.ctx = ctx
  }
}
