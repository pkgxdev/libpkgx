import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert"
import { PkgxError, panic } from "../utils/error.ts"

Deno.test("errors", async test => {

  await test.step("panic", () => {
    assertThrows(() => panic("test msg"), "test msg")
  })

  await test.step("swallow", async () => {
    await new Promise((_, reject) => reject(new BarError())).swallow(BarError)
    await new Promise((_, reject) => reject(new BazError())).swallow(BarError)
    assertRejects(() => new Promise((_, reject) => reject(new FooError())).swallow(BarError))
  })

  await test.step("new PkgxError()", () => {
    const e = new PkgxError("test msg", {ctx: 1})
    assertEquals(e.message, "test msg")
    assertEquals(e.ctx.ctx, 1)
  })
})

class FooError extends Error
{}

class BarError extends Error
{}

class BazError extends BarError
{}
