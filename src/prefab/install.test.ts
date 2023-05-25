import { useTestConfig as useTestConfigBase } from "../hooks/useConfig.test.ts"
import { assert, assertEquals, assertFalse } from "deno/testing/asserts.ts"
import install, { ConsoleLogger, Logger } from "./install.ts"
import { stub } from "deno/testing/mock.ts"
import SemVer from "../utils/semver.ts"
import { Package } from "../types.ts"

Deno.test("install()", async runner => {
  const pkg: Package = {
    project: "tea.xyz/brewkit",
    version: new SemVer("0.30.0")
  }

  const conf = useTestConfig()

  await runner.step("download & install", async () => {
    // for coverage
    const logger = ConsoleLogger()
    const stubber = stub(console, "error", x => assert(x))

    const installation = await install(pkg, logger)

    assertEquals(installation.pkg.project, pkg.project)
    assertEquals(installation.pkg.version, pkg.version)
    assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))

    /// so next test works
    installation.path.rm({ recursive: true })

    stubber.restore()
  })

  await runner.step("untar & install", async () => {
    // since we're already downloaded this tests the untar directly code-path

    const installation = await install(pkg)

    assertEquals(installation.pkg.project, pkg.project)
    assertEquals(installation.pkg.version, pkg.version)
    assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))
  })
})

Deno.test("install locks", async () => {
  const pkg: Package = {
    project: "tea.xyz/brewkit",
    version: new SemVer("0.30.0")
  }

  const conf = useTestConfig()

  let unlocked_once = false
  const logger: Logger = {
    downloading: () => assertFalse(unlocked_once),
    locking: () => {},
    installed: () => {},
    installing: () => assertFalse(unlocked_once),
    unlocking: () => unlocked_once = true
  }

  const installer1 = install(pkg, logger)
  const installer2 = install(pkg, logger)

  const [install1, install2] = await Promise.all([installer1, installer2])

  for (const installation of [install1, install2]) {
    assertEquals(installation.pkg.project, pkg.project)
    assertEquals(installation.pkg.version, pkg.version)
    assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))
  }
})

function useTestConfig() {
  return useTestConfigBase({ TEA_CACHE_DIR: Deno.makeTempDirSync() })
}
