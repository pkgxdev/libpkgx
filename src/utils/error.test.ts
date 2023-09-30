import { assertRejects, assertThrows } from "deno/assert/mod.ts"
import { panic } from "../utils/error.ts"

Deno.test("errors", async test => {
  await test.step("panic", () => {
    assertThrows(() => panic("test msg"), "test msg")
  })
  await test.step("swallow", async () => {
    await new Promise((_, reject) => reject(new BarError())).swallow(BarError)
    await new Promise((_, reject) => reject(new BazError())).swallow(BarError)
    assertRejects(() => new Promise((_, reject) => reject(new FooError())).swallow(BarError))
  })
})

class FooError extends Error
{}

class BarError extends Error
{}

class BazError extends BarError
{}
