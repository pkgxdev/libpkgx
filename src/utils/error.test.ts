import { assertEquals, assertRejects, assertThrows } from "@std/assert"
import { PkgxError, panic, swallow } from "../utils/error.ts"

Deno.test("errors", async test => {

  await test.step("panic", () => {
    assertThrows(() => panic("test msg"), "test msg")
  })

  await test.step("swallow", async () => {
    await swallow(new Promise((_, reject) => reject(new BarError())), BarError)
    await swallow(new Promise((_, reject) => reject(new BazError())), BarError)
    assertRejects(() => swallow(new Promise((_, reject) => reject(new FooError())), BarError))
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
