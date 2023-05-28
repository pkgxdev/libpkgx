import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assert } from "deno/testing/asserts.ts"
import SemVer from "../utils/semver.ts"
import { Package } from "../types.ts"
import install from "./install.ts"
import link from "./link.ts";

Deno.test("prefab.link", async runner => {
  const pkg: Package = {
    project: "tea.xyz/brewkit",
    version: new SemVer("0.30.0")
  }

  await runner.step("link()", async () => {
    useTestConfig()

    const installation = await install(pkg)
    await link(installation)
    await link(installation)  // test that calling twice serially works

    /// test symlinks work
    assert(installation.path.parent().join("v*").isDirectory())
    assert(installation.path.parent().join(`v${pkg.version.major}`).isDirectory())
  })

  await runner.step("link() ×2 at once", async () => {
    const installation = await install(pkg)
    const p1 = link(installation)
    const p2 = link(installation)

    await Promise.all([p1, p2])

    /// test symlinks work
    assert(installation.path.parent().join("v*").isDirectory())
    assert(installation.path.parent().join(`v${pkg.version.major}`).isDirectory())
  })
})
