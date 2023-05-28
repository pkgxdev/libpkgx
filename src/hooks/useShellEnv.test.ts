import { useTestConfig } from "./useTestConfig.ts"
import { assert } from "deno/testing/asserts.ts"
import * as semver from "../utils/semver.ts"
import useShellEnv from "./useShellEnv.ts"
import hydrate from "../prefab/hydrate.ts"
import resolve from "../prefab/resolve.ts"
import install from "../prefab/install.ts"

Deno.test("useShellEnv", async () => {
  const { map, flatten } = useShellEnv()
  useTestConfig()

  const rv1 = await hydrate({ project: "python.org", constraint: new semver.Range("^3.11") })
  const rv2 = await resolve(rv1.pkgs)

  const installations = rv2.installed
  for (const pkg of rv2.pending) {
    const installed = await install(pkg)
    installations.push(installed)
  }

  const env = await map({ installations })

  // test that we installed the correct platform binaries
  // ※ https://github.com/teaxyz/lib/pull/11/checks

  // deno-lint-ignore no-deprecated-deno-api
  const proc = await Deno.run({
    cmd: ["python", "--version"],
    env: flatten(env),
  })
  const { success } = await proc.status()
  proc.close()

  assert(success)
})
