import { assert, assertEquals } from "jsr:@std/assert"
import { isArray } from "is-what"
import which from "./which.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts";

Deno.test("which('python')", async () => {
  useTestConfig()
  const foo = await which('python')
  assert(!isArray(foo))
  assert(foo)
})

Deno.test("which('chalk')", async () => {
  useTestConfig()
  const foo = await which('chalk')
  assert(!isArray(foo))
  assert(foo)

  const bar = await which('chalk', { providers: false })
  assertEquals(bar, undefined)
})

Deno.test("which('nvim')", async () => {
  useTestConfig()
  const foo = await which('chalk', { all: true })
  assert(isArray(foo))
  assert(foo.length)
})
