import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assert } from "@std/assert"
import SemVer from "../utils/semver.ts"
import link from "./link.ts";

Deno.test({
  name: "plumbing.link",
  ignore: Deno.build.os == 'windows',
  async fn(runner) {
    const pkg = {project: 'python.org', version: new SemVer('3.9.0')}

    await runner.step("link()", async () => {
      const { prefix } = useTestConfig()
      const path = prefix.join("python.org/v3.9.0").mkdir('p')
      const installation = { pkg, path }

      path.join("not-empty").touch()

      await link(installation)
      await link(installation)  // test that calling twice serially works

      /// test symlinks work
      assert(installation.path.parent().join("v*").isDirectory())
      assert(installation.path.parent().join(`v${pkg.version.major}`).isDirectory())
    })

    await runner.step("link() ×2 at once", async () => {
      const { prefix } = useTestConfig()
      const path = prefix.join("python.org/v3.9.0").mkdir('p')
      const installation = { pkg, path }

      path.join("not-empty").touch()

      const p1 = link(installation)
      const p2 = link(installation)

      await Promise.all([p1, p2])

      /// test symlinks work
      assert(installation.path.parent().join("v*").isDirectory())
      assert(installation.path.parent().join(`v${pkg.version.major}`).isDirectory())
    })
  }
})
