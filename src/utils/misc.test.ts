import { assertEquals, assertRejects, assertThrows } from "deno/assert/mod.ts"
import { flatmap, validate } from "./misc.ts"
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
  assertEquals(validate.obj({ a: 1 }), { a: 1 })
  assertThrows(() => validate.obj("jkl"), "not-array: jkl")
})

Deno.test("flatmap", () => {
  assertEquals(flatmap(1, (n) => n + 1), 2)
  assertEquals(flatmap(undefined, (n: number) => n + 1), undefined)
  assertEquals(flatmap(1, (_: number) => undefined), undefined)

  const throws = (_n: number) => {
    throw Error("test error")
  }

  assertEquals(flatmap(1, throws, { rescue: true }), undefined)
  assertThrows(() => flatmap(1, throws), "test error")
})

Deno.test("async flatmap", async () => {
  const producer = <T>(value?: T, err?: Error): Promise<T | undefined | null> => {
    if (err) {
      return Promise.reject(err)
    }
    return Promise.resolve(value)
  }

  const add = (n: number) => Promise.resolve(n + 1)

  assertEquals(await flatmap(producer(1), add), 2)
  assertEquals(await flatmap(producer(undefined), add), undefined)
  assertEquals(await flatmap(producer(1), (_n) => undefined), undefined)

  assertEquals(await flatmap(producer(1, Error()), add, { rescue: true }), undefined)
  await assertRejects(() => flatmap(producer(1, Error()), add, undefined))
})

Deno.test("chuzzle", () => {
  assertEquals("".chuzzle(), undefined)
  assertEquals("test".chuzzle(), "test")
  assertEquals((1).chuzzle(), 1)
  assertEquals(NaN.chuzzle(), undefined)
})

Deno.test("set insert", () => {
  const s = new Set([1, 2, 3])

  assertEquals(s.insert(1), { inserted: false })
  assertEquals(s.insert(4), { inserted: true })
  assertEquals(s.size, 4)

  assertEquals(s.has(1), true)
  assertEquals(s.has(4), true)
})

Deno.test("array compact", () => {
  assertEquals([1, 2, undefined, null, false, 3].compact(), [1, 2, 3])
  assertEquals([1, 2, undefined, null, false, 3].compact((n) => isNumber(n) && n * 2), [2, 4, 6])

  // will fail to compile if the compiler cannot infer the type of the compact() return
  assertEquals([1, 2, undefined, null, false as false | number, 3].compact()[0] + 1, 2)

  // verifies transforming the type gives singular type return
  const foo = [1, 2, undefined, null, false, 3].compact((n) => isNumber(n) && `${n * 2}`)
  assertEquals(foo, ["2", "4", "6"])

  const throws = () => {
    throw Error("test error")
  }
  assertEquals([() => 1, () => 2, throws, () => 3].compact((n) => n() * 2, { rescue: true }), [
    2,
    4,
    6,
  ])
  assertThrows(() => [() => 1, () => 2, throws, () => 3].compact((n) => n() * 2))
})
