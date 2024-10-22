import specimen, { provides, dependencies, available, runtime_env, completion, companions  } from "./useSyncCache.ts"
import { useTestConfig } from "./useTestConfig.ts"
import { assert, assertEquals } from "jsr:@std/assert"
import { _internals } from "./useSync.ts"
import usePantry from "./usePantry.ts"

// NOTE actually syncs from github
// TODO unit tests should not do actual network calls, instead make an implementation suite

Deno.test({
  name: "useSyncCache",
  ignore: Deno.build.os == 'windows',
  sanitizeResources: false,
  async fn() {
    useTestConfig()
    await _internals.sync(usePantry().prefix.parent())
    await specimen()

    //TODO test better
    assert(available())
    assertEquals((await provides('node'))?.[0], 'nodejs.org')
    // assertEquals((await dependencies('nodejs.org'))?.length, 3)
    assert(new Set(await completion('nod')).has("node"))
    assertEquals((await companions("nodejs.org"))?.[0]?.project, "npmjs.com")
    assert((await runtime_env("numpy.org"))?.["PYTHONPATH"])
  }
})
