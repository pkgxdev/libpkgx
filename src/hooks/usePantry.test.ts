import { assert, assertEquals, assertThrows } from "deno/assert/mod.ts"
import usePantry, { validatePackageRequirement } from "./usePantry.ts"
import { _internals as _config_internals } from "./useConfig.ts"
import { useTestConfig } from "./useTestConfig.ts"
import { _internals } from "../utils/host.ts"
import { stub } from "deno/testing/mock.ts"
import SemVer from "../utils/semver.ts"
import Path from "../utils/Path.ts"
import useSync from "./useSync.ts"

Deno.test("provides()", async () => {
  useTestConfig()
  await useSync()
  const exenames = await usePantry().project("python.org").provides()
  assert(exenames.includes("python"))
})

Deno.test("which()", async () => {
  useTestConfig()
  await useSync()
  const pkg = await usePantry().which({ interprets: ".py" })
  assertEquals(pkg?.project, "python.org")
})

Deno.test("provider()", async () => {
  useTestConfig()
  await useSync()
  const provides = await usePantry().project("npmjs.com").provider()
  const foo = provides!('truffle')
  assertEquals(foo![0], 'npx')
})

Deno.test("available()", async () => {
  useTestConfig()
  await useSync()
  const stubber = stub(_internals, 'platform', () => "darwin" as "darwin" | "linux")
  assert(await usePantry().project("agpt.co").available())
  stubber.restore()
})

Deno.test("runtime.env", async () => {
  const srcroot = (() => {
    // because when running via dnt the path of this file is different
    if (Path.cwd().parent().parent().join("fixtures").isDirectory()) {
      return Path.cwd().parent().parent()
    } else {
      return new Path(new URL(import.meta.url).pathname).parent().parent().parent()
    }
  })()
  const PKGX_PANTRY_PATH = srcroot.join("fixtures").string
  const { prefix } = useTestConfig({ PKGX_PANTRY_PATH })

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

Deno.test("missing()", () => {
  useTestConfig({PKGX_PANTRY_PATH: "/a"})
  assert(usePantry().missing())
})


Deno.test("validatePackageRequirement - valid input", () => {
  const result = validatePackageRequirement("pkgx.sh/test", "^1.0.0")
  assertEquals(result?.project, "pkgx.sh/test")
  assertEquals(result?.constraint.toString(), "^1")
})

Deno.test("validatePackageRequirement - invalid constraint", () => {
  assertThrows(() => validatePackageRequirement("pkgx.sh/test", "nonsense"))
})

Deno.test("validatePackageRequirement - number constraint", () => {
  const result = validatePackageRequirement("pkgx.sh/test", 1)
  assertEquals(result?.constraint.toString(), "^1")
})


Deno.test("validatePackageRequirement - valid input", () => {
  const result = validatePackageRequirement("pkgx.sh/test", "^1.0.0")
  assertEquals(result?.project, "pkgx.sh/test")
  assertEquals(result?.constraint.toString(), "^1")
})

Deno.test("validatePackageRequirement - invalid constraint", () => {
  assertThrows(() => validatePackageRequirement("pkgx.sh/test", "nonsense"))
})

Deno.test("validatePackageRequirement - number constraint", () => {
  const result = validatePackageRequirement("pkgx.sh/test", 1)
  assertEquals(result?.constraint.toString(), "^1")
})
