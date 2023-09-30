import { useTestConfig } from "./useTestConfig.ts"
import { assert } from "deno/assert/mod.ts"
import usePantry from "./usePantry.ts"
import useSync from "./useSync.ts"

Deno.test("useSync", async runner => {
  await runner.step("w/o git", async () => {
    const PKGX_DIR = Deno.makeTempDirSync()
    const conf = useTestConfig({ PKGX_DIR, HOME: `${PKGX_DIR}/home` })
    assert(conf.git === undefined)
    await test()
  })

  await runner.step("w/git", async () => {
    const PKGX_DIR = Deno.makeTempDirSync()
    const conf = useTestConfig({ PKGX_DIR, HOME: `${PKGX_DIR}/home`, PATH: "/usr/bin" })
    assert(conf.git !== undefined)
    await test()

    // test the “already cloned” code-path
    await useSync()
  })

  async function test() {
    let errord = false
    try {
      await usePantry().project("python.org").available()
    } catch {
      errord = true
    }
    assert(errord, `should be no pantry but there is! ${usePantry().prefix}`)

    await useSync()

    assert(await usePantry().project("python.org").available())
  }
})
