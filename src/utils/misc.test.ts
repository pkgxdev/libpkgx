import { assertEquals, assertRejects, assertThrows } from "deno/testing/asserts.ts"
import { async_flatmap, flatmap, validate } from "./misc.ts"

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

Deno.test("flatmap", () => {
  assertEquals(flatmap(1, (n) => n + 1), 2)
  assertEquals(flatmap(undefined, (n: number) => n + 1), undefined)

  const throws = (_n: number) => {
    throw Error("test error")
  }

  assertEquals(flatmap(1, throws, {rescue: true}), undefined)
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

  assertEquals(await async_flatmap(producer(1), add), 2)
  assertEquals(await async_flatmap(producer(undefined), add), undefined)
  assertEquals(await async_flatmap(producer(1), (_n) => undefined), undefined)

  assertEquals(await async_flatmap(producer(1, Error()), add, {rescue: true}), undefined)
  await assertRejects(() => async_flatmap(producer(1, Error()), add, undefined))
})

Deno.test("chuzzle", () => {
  assertEquals("".chuzzle(), undefined)
  assertEquals("test".chuzzle(), "test")
  assertEquals((1).chuzzle(), 1)
  assertEquals(NaN.chuzzle(), undefined)
})
