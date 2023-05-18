import SemVer, * as semver from "../utils/semver.ts"
import { useTestConfig } from "./useConfig.test.ts"
import install from "../prefab/install.ts"
import useCellar from "./useCellar.ts"

Deno.test("resolve()", async () => {
  useTestConfig()

  const pkgrq = { project: "python.org", version: new SemVer("3.11.3")}
  const installation = await install(pkgrq)

  await useCellar().resolve(installation)
  await useCellar().resolve(installation.pkg)
  await useCellar().resolve({ project: "python.org", constraint: new semver.Range("^3") })
  await useCellar().resolve(installation.path)
})
