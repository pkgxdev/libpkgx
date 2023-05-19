import { useTestConfig } from "../hooks/useConfig.test.ts"
import { assertEquals } from "deno/testing/asserts.ts"
import SemVer from "../utils/semver.ts"
import { Package } from "../types.ts"
import install from "./install.ts"

Deno.test("install.integration.tests", async runner => {
  const pkg: Package = {
    project: "tea.xyz/brewkit",
    version: new SemVer("0.30.0")
  }

  const conf = useTestConfig()

  await runner.step("download & install", async () => {
    const installation = await install(pkg)

    assertEquals(installation.pkg.project, pkg.project)
    assertEquals(installation.pkg.version, pkg.version)
    assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))

    installation.path.rm({ recursive: true  })
  })

  await runner.step("untar & install", async () => {
    // since we're already downloaded this tests the untar directly code-path

    const installation = await install(pkg)

    assertEquals(installation.pkg.project, pkg.project)
    assertEquals(installation.pkg.version, pkg.version)
    assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))
  })
})
