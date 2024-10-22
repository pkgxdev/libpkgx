import specimen, { _internals } from "./useSync.ts"
import { useTestConfig } from "./useTestConfig.ts"
import * as mock from "jsr:@std/testing/mock"
import { assert } from "jsr:@std/assert"
import usePantry from "./usePantry.ts"

// NOTE actually syncs from github
// TODO unit tests should not do actual network calls, instead make an implementation suite

Deno.test("useSync", async runner => {
  const stub = mock.stub(_internals, "cache", async () => {})

  try {
    await runner.step("w/o git", async () => {
      const conf = useTestConfig({})
      usePantry().prefix.rm({ recursive: true })  // we need to delete the fixtured pantry
      assert(conf.git === undefined)
      await test()
    })

    await runner.step({
      name: "w/git",
      ignore: Deno.build.os == 'windows' && !Deno.env.get("CI"),
      async fn() {
        const conf = useTestConfig({ PATH: "/usr/bin" })
        usePantry().prefix.rm({ recursive: true })  // we need to delete the fixtured pantry
        assert(conf.git !== undefined)
        await test()

        // test the “already cloned” code-path
        await specimen()
      }
    })

    async function test() {
      let errord = false
      try {
        await usePantry().project("gnu.org/gcc").available()
      } catch {
        errord = true
      }
      assert(errord, `should be no pantry but there is! ${usePantry().prefix}`)

      await specimen()

      assert(await usePantry().project("gnu.org/gcc").available())
    }

  } finally {
    stub.restore()
  }

})
