//CONTRACT you can’t use anything from hooks

import { is_what, type PlainObject } from "../deps.ts"
const { isPlainObject, isArray } = is_what

function validate_str(input: unknown): string {
  if (typeof input == 'boolean') return input ? 'true' : 'false'
  if (typeof input == 'number') return input.toString()
  if (typeof input != 'string') throw new Error(`not-string: ${input}`)
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
  arr: validate_arr
}

export { validate }


////////////////////////////////////////////////////////////// base extensions
type Falsy = false | 0 | '' | null | undefined

export function insert<T>(set: Set<T>, t: T): { inserted: boolean } {
  if (set.has(t)) {
    return {inserted: false}
  } else {
    set.add(t)
    return {inserted: true}
  }
}

export function compact<T>(arr: Array<T>): Array<Exclude<T, Falsy>>
export function compact<T, S>(arr: Array<T>, body: (t: T) => S | Falsy, opts?: { rescue: boolean }): Array<S>
export function compact<T, S>(arr: Array<T>, body?: (t: T) => S | T | Falsy, opts?: { rescue: boolean }): Array<S | T>
export function compact<T, S>(arr: Array<T>, body?: (t: T) => S | Falsy, opts?: { rescue: boolean }): Array<S | T> {
  const rv: Array<S | T> = []
  for (const e of arr) {
    try {
      const f = body ? body(e) : e
      if (f) rv.push(f as S | T)
    } catch (err) {
      if (opts === undefined || opts.rescue === false) throw err
    }
  }
  return rv
}

export function flatmap<S, T>(t: T | Falsy, body: (t: T) => S | Falsy, opts?: {rescue: boolean}): S | undefined;
export function flatmap<S, T>(t: Promise<T | Falsy>, body: (t: T) => Promise<S | Falsy>, opts?: {rescue: boolean}): Promise<S | undefined>;
export function flatmap<S, T>(t: Promise<T | Falsy> | (T | Falsy), body: (t: T) => (S | Falsy) | Promise<S | Falsy>, opts?: {rescue: boolean}): Promise<S | undefined> | (S | undefined) {
  try {
    if (t instanceof Promise) {
      const foo = t.then(t => {
        if (!t) return
        const s = body(t) as Promise<S | Falsy>
        if (!s) return
        const bar = s.then(body => body || undefined)
        if (opts?.rescue) {
          return bar.catch(() => { return undefined })
        } else {
          return bar
        }
      })
      return foo
    } else {
      if (t) return body(t) as (S | Falsy) || undefined
    }
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}

//////////////////////////////////////////////////////// chuzzle
export function chuzzle(input: string): string | undefined
export function chuzzle(input: number): number | undefined
export function chuzzle(input: string | number): string | number | undefined {
  if (typeof input === "string") {
    return input.trim() || undefined
  } else {
    return Number.isNaN(input) ? undefined : input
  }
}
