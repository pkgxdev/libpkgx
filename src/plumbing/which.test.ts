import { assert, assertEquals } from "deno/assert/mod.ts"
import { isArray } from "is-what"
import which from "./which.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts";
import useSync from "../hooks/useSync.ts";

Deno.test("which('ls')", async () => {
  useTestConfig()
  await useSync()
  const foo = await which('ls')
  assert(!isArray(foo))
  assert(foo)
})

Deno.test("which('kill-port')", async () => {
  useTestConfig()
  await useSync()
  const foo = await which('kill-port')
  assert(!isArray(foo))
  assert(foo)

  const bar = await which('kill-port', { providers: false })
  assertEquals(bar, undefined)
})

Deno.test("which('nvim')", async () => {
  useTestConfig()
  await useSync()
  const foo = await which('kill-port', { all: true })
  assert(isArray(foo))
  assert(foo.length)
})
