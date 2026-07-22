import { assertEquals, assertRejects, assertThrows } from "@std/assert"
import { chuzzle, compact, flatmap, insert, validate } from "./misc.ts"
import { isNumber } from "is-what"

Deno.test("validate string", () => {
  assertEquals(validate.str(true), "true")
  assertEquals(validate.str(false), "false")
  assertEquals(validate.str(1), "1")

  assertThrows(() => validate.str({}), "not-string: {}")
})

Deno.test("validate array", () => {
  assertEquals(validate.arr(["1", "2"]), ["1", "2"])
  assertThrows(() => validate.arr("jkl"), "not-array: jkl")
})

Deno.test("validate obj", () => {
  assertEquals(validate.obj({a: 1}), {a: 1})
  assertThrows(() => validate.obj("jkl"), "not-array: jkl")
})

Deno.test("flatmap", () => {
  assertEquals(flatmap(1, (n) => n + 1), 2)
  assertEquals(flatmap(undefined, (n: number) => n + 1), undefined)
  assertEquals(flatmap(1, (_: number) => undefined), undefined)

  const throws = (_n: number) => {
    throw Error("test error")
  }

  assertEquals(flatmap(1, throws, {rescue: true}), undefined)
  assertThrows(() => flatmap(1, throws), "test error")
})

Deno.test("async flatmap", async () => {
  const add = (n: number) => Promise.resolve(n + 1)

  assertEquals(await flatmap(Promise.resolve(1), add), 2)
  assertEquals(await flatmap(Promise.resolve(undefined), add), undefined)
  assertEquals(await flatmap(Promise.resolve(1), (_n) => undefined), undefined)

  assertEquals(await flatmap(Promise.resolve(1), () => Promise.reject(new Error()), {rescue: true}), undefined)
  await assertRejects(() => flatmap(Promise.resolve(1), () => Promise.reject("new Error()")) ?? Promise.resolve())
})

Deno.test("chuzzle", () => {
  assertEquals(chuzzle(""), undefined)
  assertEquals(chuzzle("test"), "test")
  assertEquals(chuzzle(1), 1)
  assertEquals(chuzzle(NaN), undefined)
})

Deno.test("set insert", () => {
  const s = new Set([1, 2, 3])

  assertEquals(insert(s, 1), {inserted: false})
  assertEquals(insert(s, 4), {inserted: true})
  assertEquals(s.size, 4)

  assertEquals(s.has(1), true)
  assertEquals(s.has(4), true)
})

Deno.test("array compact", () => {
  assertEquals(compact([1, 2, undefined, null, false, 3]), [1, 2, 3])
  assertEquals(compact([1, 2, undefined, null, false, 3], (n) => isNumber(n) && n * 2), [2, 4, 6])

  // will fail to compile if the compiler cannot infer the type of the compact() return
  assertEquals(compact([1, 2, undefined, null, false as false | number, 3])[0] + 1, 2)

  // verifies transforming the type gives singular type return
  const foo = compact([1, 2, undefined, null, false, 3], (n) => isNumber(n) && `${n * 2}`)
  assertEquals(foo, ["2", "4", "6"])

  const throws = () => {
    throw Error("test error")
  }
  assertEquals(compact([()=>1, ()=>2, throws, ()=>3], (n) => n() * 2, { rescue: true }), [2, 4, 6])
  assertThrows(() => compact([()=>1, ()=>2, throws, ()=>3], (n) => n() * 2))
})
