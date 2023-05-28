import { useTestConfig } from "./useTestConfig.ts"
import * as semver from "../utils/semver.ts"
import useShellEnv from "./useShellEnv.ts"
import hydrate from "../prefab/hydrate.ts"
import resolve from "../prefab/resolve.ts"
import install from "../prefab/install.ts"

Deno.test("useShellEnv", async () => {

  useTestConfig()

  const rv1 = await hydrate({ project: "python.org", constraint: new semver.Range("^3.11") })
  const rv2 = await resolve(rv1.wet)

  const installations = rv2.installed
  for (const pkg of rv2.pending) {
    const installed = await install(pkg)
    installations.push(installed)
  }

  await useShellEnv().map({ installations })
})
