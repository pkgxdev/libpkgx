import { assert, assertEquals, assertThrows } from "@std/assert"
import usePantry, { validatePackageRequirement } from "./usePantry.ts"
import { useTestConfig, srcroot } from "./useTestConfig.ts"
import { _internals } from "../utils/host.ts"
import { stub } from "@std/testing/mock"
import SemVer from "../utils/semver.ts"

Deno.test("provides()", async () => {
  useTestConfig()
  const exenames = await usePantry().project("python.org").provides()
  assert(exenames.includes("python"))
})

Deno.test("which()", async () => {
  useTestConfig()
  const pkg = await usePantry().which({ interprets: ".py" })
  assertEquals(pkg?.project, "python.org")
})

Deno.test("provider()", async () => {
  useTestConfig()
  const provides = await usePantry().project("npmjs.com").provider()
  const foo = provides!('truffle')
  assertEquals(foo![0], 'npx')
})

Deno.test("available()", async () => {
  useTestConfig()
  const stubber = stub(_internals, 'platform', () => "darwin" as "darwin" | "linux")
  assert(await usePantry().project("python.org").available())
  stubber.restore()
})

Deno.test("runtime.env", async () => {
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
})

Deno.test("missing - without cache", () => {
  useTestConfig()
  usePantry().prefix.rm({ recursive: true })
  assert(usePantry().missing())
})

Deno.test("missing - with cache", () => {
  useTestConfig().cache.mkdir("p").join('pantry.db').touch()
  usePantry().prefix.rm({ recursive: true })
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

Deno.test("find", async () => {
  useTestConfig()
  const foo = await usePantry().find("python@3.11")
  assertEquals(foo.length, 1)
  assertEquals(foo[0].project, "python.org")
})