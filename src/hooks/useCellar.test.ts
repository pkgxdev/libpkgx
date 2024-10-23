import { assertEquals, assertRejects } from "@std/assert"
import SemVer, * as semver from "../utils/semver.ts"
import { useTestConfig } from "./useTestConfig.ts"
import useCellar from "./useCellar.ts"

Deno.test("useCellar.resolve()", async () => {
  useTestConfig()

  const pkg = { project: "python.org", version: new SemVer("3.11.3") }
  const path = useCellar().shelf(pkg.project).join(`v${pkg.version}`).mkdir('p')
  path.join("cant-be-empty").touch()
  const installation = { pkg, path }

  await useCellar().resolve(installation)
  await useCellar().resolve(installation.pkg)
  await useCellar().resolve({ project: "python.org", constraint: new semver.Range("^3") })
  await useCellar().resolve(installation.path)

  await assertRejects(() => useCellar().resolve({ project: "python.org", constraint: new semver.Range("@300")}))
})

Deno.test("useCellar.has()", async () => {
  useTestConfig()

  const pkg = { project: "beyondgrep.com", version: new SemVer("3.6.0") }

  assertEquals(await useCellar().has(pkg), undefined)

  const path = useCellar().shelf(pkg.project).join(`v${pkg.version}`).mkdir('p')
  path.join("cant-be-empty").touch()
  const installation = { pkg, path }

  assertEquals(await useCellar().has(pkg), installation)
})
