import { assert, assertEquals } from "deno/testing/asserts.ts"
import { useTestConfig } from "./useTestConfig.ts"
import { _internals } from "../utils/host.ts"
import { stub } from "deno/testing/mock.ts"
import SemVer from "../utils/semver.ts"
import usePantry from "./usePantry.ts"
import Path from "../utils/Path.ts"
import { _internals as _config_internals } from "./useConfig.ts"

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

Deno.test("runtime.env", async () => {
  const TEA_PANTRY_PATH = new Path(Deno.env.get("SRCROOT")!).join("fixtures").string
  const { prefix } = useTestConfig({ TEA_PANTRY_PATH  })

  const deps = [{
    pkg: {
      project: "bar.com",
      version: new SemVer("1.2.3")
    },
    path: prefix.join("bar.com/v1.2.3")
  }]

  const env = await usePantry().project("foo.com").runtime.env(new SemVer("2.3.4"), deps)

  assertEquals(env.BAZ, prefix.join("bar.com/v1.2.3/baz").string)

  _config_internals.reset()
})
