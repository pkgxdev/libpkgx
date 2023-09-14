//CONTRACT you can’t use anything from hooks

import { is_what, PlainObject } from "../deps.ts"
const { isPlainObject, isArray } = is_what

function validate_str(input: unknown): string {
  if (typeof input == "boolean") return input ? "true" : "false"
  if (typeof input == "number") return input.toString()
  if (typeof input != "string") throw new Error(`not-string: ${input}`)
  return input
}

function validate_plain_obj(input: unknown): PlainObject {
  if (!isPlainObject(input)) throw new Error(`not-plain-obj: ${JSON.stringify(input)}`)
  return input
}

function validate_arr<T>(input: unknown): Array<T> {
  if (!isArray(input)) throw new Error(`not-array: ${JSON.stringify(input)}`)
  return input
}

const validate = {
  str: validate_str,
  obj: validate_plain_obj,
  arr: validate_arr,
}

export { validate }

////////////////////////////////////////////////////////////// base extensions
type Falsy = false | 0 | "" | null | undefined

declare global {
  interface Array<T> {
    compact(): Array<Exclude<T, Falsy>>
    compact<S>(body: (t: T) => S | Falsy): Array<S>
    compact<S>(body?: (t: T) => S | T | Falsy, opts?: { rescue: boolean }): Array<S | T>
  }

  interface Set<T> {
    insert(t: T): { inserted: boolean }
  }
}

Set.prototype.insert = function <T>(t: T) {
  if (this.has(t)) {
    return { inserted: false }
  } else {
    this.add(t)
    return { inserted: true }
  }
}

Array.prototype.compact = function <T, S>(
  body?: (t: T) => S | Falsy,
  opts?: { rescue: boolean },
): S[] {
  const rv: S[] = []
  for (const e of this) {
    try {
      const f = body ? body(e) : e
      if (f) rv.push(f)
    } catch (err) {
      if (opts === undefined || opts.rescue === false) throw err
    }
  }
  return rv
}

export function flatmap<S, T>(
  t: T | Falsy,
  body: (t: T) => S | Falsy,
  opts?: { rescue?: boolean },
): S | undefined
export function flatmap<S, T>(
  t: Promise<T | Falsy>,
  body: (t: T) => Promise<S | Falsy>,
  opts?: { rescue?: boolean },
): Promise<S | undefined>
export function flatmap<S, T>(
  t: Promise<T | Falsy> | (T | Falsy),
  body: (t: T) => (S | Falsy) | Promise<S | Falsy>,
  opts?: { rescue?: boolean },
): Promise<S | undefined> | (S | undefined) {
  try {
    if (t instanceof Promise) {
      const foo = t.then((t) => {
        if (!t) return
        const s = body(t) as Promise<S | Falsy>
        if (!s) return
        const bar = s
          .then((body) => body || undefined)
          .catch((err) => {
            if (!opts?.rescue) throw err
            else return undefined
          })
        return bar
      })
      return foo
    } else {
      if (t) return body(t) as (S | Falsy) || undefined
    }
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}

// export async function async_flatmap<S, T>(t: Promise<T | Falsy>, body: (t: T) => Promise<S | Falsy>, opts?: {rescue?: boolean}): Promise<S | undefined> {
//   try {
//     const tt = await t
//     if (tt) return await body(tt) || undefined
//   } catch (err) {
//     if (!opts?.rescue) throw err
//   }
// }

//////////////////////////////////////////////////////// chuzzle
declare global {
  interface String {
    chuzzle(): string | undefined
  }

  interface Number {
    chuzzle(): number | undefined
  }
}

String.prototype.chuzzle = function () {
  return this.trim() || undefined
}

Number.prototype.chuzzle = function () {
  return Number.isNaN(this) ? undefined : this as number
}
