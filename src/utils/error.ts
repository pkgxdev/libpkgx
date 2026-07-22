// deno-lint-ignore-file no-explicit-any

export function panic(message?: string): never {
  throw new Error(message)
}

export function swallow<T>(
  promise: Promise<T>,
  errorClass?: new (...args: any) => any,
): Promise<T | undefined> {
  return promise.catch((err: unknown) => {
    if (errorClass && !(err instanceof errorClass)) {
      throw err
    }
    return undefined
  })
}

export class PkgxError extends Error {
  ctx: any
  constructor(msg: string, ctx?: any) {
    super(msg)
    this.ctx = ctx
  }
}
