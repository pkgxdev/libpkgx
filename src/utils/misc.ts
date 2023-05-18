//CONTRACT you can’t use anything from hooks

import { isPlainObject, isArray, PlainObject } from "is-what"

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
declare global {
  interface Array<T> {
    compact<S>(body?: (t: T) => S | null | undefined | false, opts?: { rescue: boolean }): Array<S>
  }

  interface Set<T> {
    insert(t: T): { inserted: boolean }
  }
}

Set.prototype.insert = function<T>(t: T) {
  if (this.has(t)) {
    return {inserted: false}
  } else {
    this.add(t)
    return {inserted: true}
  }
}

Array.prototype.compact = function<T, S>(body?: (t: T) => S | null | undefined | false, opts?: { rescue: boolean }) {
  const rv: Array<S> = []
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

export function flatmap<S, T>(t: T | undefined | null, body: (t: T) => S | undefined, opts?: {rescue?: boolean}): NonNullable<S> | undefined {
  try {
    if (t) return body(t) ?? undefined
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}

export async function async_flatmap<S, T>(t: Promise<T | undefined | null>, body: (t: T) => Promise<S> | undefined, opts?: {rescue?: boolean}): Promise<NonNullable<S> | undefined> {
  try {
    const tt = await t
    if (tt) return await body(tt) ?? undefined
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}

//////////////////////////////////////////////////////// chuzzle
declare global {
  interface String {
    chuzzle(): string | undefined
  }

  interface Number {
    chuzzle(): number | undefined
  }
}

String.prototype.chuzzle = function() {
  return this.trim() || undefined
}

Number.prototype.chuzzle = function() {
  return Number.isNaN(this) ? undefined : this as number
}
