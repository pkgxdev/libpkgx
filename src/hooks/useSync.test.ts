import { useTestConfig } from "./useConfig.test.ts"
import { assert } from "deno/testing/asserts.ts"
import usePantry from "./usePantry.ts"
import useSync from "./useSync.ts"

Deno.test("useSync", async runner => {
  await runner.step("w/o git", async () => {
    const TEA_PREFIX = Deno.makeTempDirSync()
    const conf = useTestConfig({ TEA_PREFIX, TEA_PANTRY_PATH: `${TEA_PREFIX}/tea.xyz/var/pantry` })
    assert(conf.git === undefined)
    await test()
  })

  await runner.step("w/git", async () => {
    const TEA_PREFIX = Deno.makeTempDirSync()
    const conf = useTestConfig({ TEA_PREFIX, TEA_PANTRY_PATH: `${TEA_PREFIX}/tea.xyz/var/pantry`, PATH: "/usr/bin" })
    assert(conf.git !== undefined)
    await test()

    // test the “already cloned” code-path
    await useSync()
  })

  async function test() {
    let errord = false
    try {
      await usePantry().project("tea.xyz/brewkit").available()
    } catch {
      errord = true
    }
    assert(errord)

    await useSync()

    assert(await usePantry().project("tea.xyz/brewkit").available())
  }
})
