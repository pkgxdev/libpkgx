// deno-lint-ignore-file no-explicit-any
import { useTestConfig, srcroot } from "../hooks/useTestConfig.ts"
import { assert, assertEquals, assertFalse } from "deno/assert/mod.ts"
import install, { ConsoleLogger, Logger } from "./install.ts"
import { stub } from "deno/testing/mock.ts"
import SemVer from "../utils/semver.ts"
import { Package } from "../types.ts"
import host from "../utils/host.ts";
import { _internals } from "../hooks/useFetch.ts"

Deno.test("install", async runner => {

  const pkg: Package = {
    project: "foo.com",
    version: new SemVer("5.43.0")
  }
  const { arch, platform } = host()

  // deno-lint-ignore require-await
  const fetch_stub = stub(_internals, "fetch", async opts => {
    if ((opts as URL).pathname.endsWith("sha256sum")) {
      return {
        ok: true,
        status: 200,
        text() {
          return Promise.resolve("03301cc30a9ca1fdc90dc130da2b3672932f331beae78e65e8bb4e0c6c99840b")
        }
      }
    } else {
      return {status: 304, ok: true} as any
    }
  })

  try {
    await runner.step("install()", async runner => {
      const conf = useTestConfig({ CI: "1" }) // CI to force .gz compression

      /// download() will use the cached version and not do http
      srcroot.join("fixtures/foo.com-5.43.0.tgz").cp({ to:
        conf.cache.mkdir('p').join(`foo.com-5.43.0+${platform}+${arch}.tar.gz`)
      })

      await runner.step("download & install", async () => {
        // for coverage
        const logger = ConsoleLogger()
        // const stubber = stub(console, "error", x => assert(x))

        const installation = await install(pkg, logger)

        assertEquals(installation.pkg.project, pkg.project)
        assertEquals(installation.pkg.version, pkg.version)
        assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))

        /// so next test works
        installation.path.rm({ recursive: true })

        // stubber.restore()
      })

      await runner.step("untar & install", async () => {
        // since we're already downloaded this tests the untar directly code-path
        // also tests we can overwrite stuff since that seems to be a thing we expect

        const installation = await install(pkg)

        assertEquals(installation.pkg.project, pkg.project)
        assertEquals(installation.pkg.version, pkg.version)
        assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))
      })
    })

    await runner.step("install locks", async () => {

      const conf = useTestConfig({ CI: "1" })

      /// download() will use the cached version and not do http
      srcroot.join("fixtures/foo.com-5.43.0.tgz").cp({ to:
        conf.cache.mkdir('p').join(`foo.com-5.43.0+${platform}+${arch}.tar.gz`)
      })

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

  } finally {
    fetch_stub.restore()
  }
})
