import { assert, assertEquals } from "deno/testing/asserts.ts"
import usePantry from './usePantry.ts'
import { _internals } from "../utils/host.ts"
import { stub } from "deno/testing/mock.ts"

Deno.test("provides()", async () => {
  const exenames = await usePantry().project("python.org").provides()
  assert(exenames.includes("python"))
})

Deno.test("which()", async () => {
  const pkg = await usePantry().which({ interprets: ".py" })
  assertEquals(pkg?.project, "python.org")
})

Deno.test("provider()", async () => {
  const provides = await usePantry().project("npmjs.com").provider()
  const foo = provides!('truffle')
  assertEquals(foo![0], 'npx')
})

Deno.test("available()", async () => {
  const stubber = stub(_internals, 'platform', () => "darwin" as "darwin" | "linux")
  assert(await usePantry().project("agpt.co").available())
  stubber.restore()
})
