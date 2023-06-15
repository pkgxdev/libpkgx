import { assert, assertEquals, assertFalse, assertThrows, assertMatch } from "deno/testing/asserts.ts"
import { _internals, ConfigDefault } from "./useConfig.ts"
import { useTestConfig } from "./useTestConfig.ts"
import Path from "../utils/Path.ts"

Deno.test("useConfig", () => {
  let config = useTestConfig()

  if (Deno === undefined) {
    assertMatch(config.UserAgent!, /tea.lib\/\d+\.\d+.\d+/)
  } else {
    assertEquals(config.UserAgent, "tea.lib")
  }

  config = ConfigDefault({ TEA_PANTRY_PATH: "/foo:/bar", CI: "true" })
  assertEquals(config.pantries.map(x => x.string), ["/foo", "/bar"])
  assertEquals(config.options.compression, "gz")

  assertFalse(_internals.boolize("false"))
  assertFalse(_internals.boolize("0"))
  assertFalse(_internals.boolize("no"))
  assert(_internals.boolize("1"))
  assert(_internals.boolize("yes"))

  assert(_internals.initialized())
})

Deno.test("useConfig empty TEA_PREFIX is ignored", () => {
  assertEquals(ConfigDefault({ TEA_PREFIX: "" }).prefix, Path.home().join(".tea"))
  assertEquals(ConfigDefault({ TEA_PREFIX: "   " }).prefix, Path.home().join(".tea"))
  assertEquals(ConfigDefault({ TEA_PREFIX: " /  " }).prefix, Path.root)
  assertThrows(() => ConfigDefault({ TEA_PREFIX: " foo  " }))
  assertThrows(() => ConfigDefault({ TEA_PREFIX: "foo" }))
})

Deno.test("useConfig empty TEA_PANTRY_PATH is ignored", () => {
  assertEquals(ConfigDefault({ TEA_PANTRY_PATH: "" }).pantries, [])
  assertEquals(ConfigDefault({ TEA_PANTRY_PATH: "  : :" }).pantries, [])
})
