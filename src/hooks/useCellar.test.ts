import { assert, assertEquals } from "deno/testing/asserts.ts"
import SemVer, * as semver from "../utils/semver.ts"
import { useTestConfig } from "./useTestConfig.ts"
import install from "../plumbing/install.ts"
import useCellar from "./useCellar.ts"

Deno.test("useCellar.resolve()", async () => {
  useTestConfig()

  const pkgrq = { project: "python.org", version: new SemVer("3.11.3")}
  const installation = await install(pkgrq)

  await useCellar().resolve(installation)
  await useCellar().resolve(installation.pkg)
  await useCellar().resolve({ project: "python.org", constraint: new semver.Range("^3") })
  await useCellar().resolve(installation.path)
})

Deno.test("useCellar.has()", async () => {
  useTestConfig()

  const rq = { project: "beyondgrep.com", version: new SemVer("3.6.0") }

  assertEquals(await useCellar().has(rq), undefined)

  const installation = await install(rq)

  assertEquals(await useCellar().has(rq), installation)
})
