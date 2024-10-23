import { assertEquals } from "@std/assert"
import { useTestConfig } from "./useTestConfig.ts"
import useMoustaches from "./useMoustaches.ts"
import { Package } from "../types.ts"
import SemVer from "../utils/semver.ts"

Deno.test("useMoustaches", () => {
  const conf = useTestConfig()
  const moustaches = useMoustaches()

  const pkg: Package = {
    project: "pkgx.sh/test",
    version: new SemVer("1.0.0")
  }

  const tokens = moustaches.tokenize.all(pkg, [])
  assertEquals(tokens[0].to, conf.prefix.join(`pkgx.sh/test/v${pkg.version}`).string)
})
