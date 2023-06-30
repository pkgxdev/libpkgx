import { assertThrows } from "deno/testing/asserts.ts"
import { panic } from "../utils/error.ts"

Deno.test("errors", async test => {
  await test.step("panic", () => {
    assertThrows(() => panic("test msg"), "test msg")
  })
})
