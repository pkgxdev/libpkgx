import { assertEquals } from "deno/testing/asserts.ts"
import { useTestConfig } from "./useConfig.test.ts"
import useMoustaches from "./useMoustaches.ts"
import { Package } from "../types.ts"
import SemVer from "../utils/semver.ts"

Deno.test("useMoustaches", () => {
  const conf = useTestConfig()
  const moustaches = useMoustaches()

  const pkg: Package = {
    project: "tea.xyz/test",
    version: new SemVer("1.0.0")
  }

  const tokens = moustaches.tokenize.all(pkg, [])
  assertEquals(tokens[0].to, conf.prefix.join(`tea.xyz/test/v${pkg.version}`).string)
})
