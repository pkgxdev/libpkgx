import { assert, assertEquals } from "deno/testing/asserts.ts"
import { isArray } from "is-what"
import which from "./which.ts"

Deno.test("which('ls')", async () => {
  const foo = await which("ls")
  assert(!isArray(foo))
  assert(foo)
})

Deno.test("which('kill-port')", async () => {
  const foo = await which("kill-port")
  assert(!isArray(foo))
  assert(foo)

  const bar = await which("kill-port", { providers: false })
  assertEquals(bar, undefined)
})

Deno.test("which('nvim')", async () => {
  const foo = await which("kill-port", { all: true })
  assert(isArray(foo))
  assert(foo.length)
})
