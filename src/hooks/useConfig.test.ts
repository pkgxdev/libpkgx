import { assert, assertEquals, assertFalse, assertThrows, assertMatch } from "deno/assert/mod.ts"
import { _internals, ConfigDefault } from "./useConfig.ts"
import { useTestConfig } from "./useTestConfig.ts"
import Path from "../utils/Path.ts"

Deno.test("useConfig", () => {
  let config = useTestConfig()

  if (Deno === undefined) {
    assertMatch(config.UserAgent!, /libpkgx\/\d+\.\d+.\d+/)
  } else {
    assertEquals(config.UserAgent, "libpkgx")
  }

  config = ConfigDefault({ PKGX_PANTRY_PATH: "/foo:/bar", CI: "true" })
  assertEquals(config.pantries.map(x => x.string), ["/foo", "/bar"])
  assertEquals(config.options.compression, "gz")

  assertFalse(_internals.boolize("false"))
  assertFalse(_internals.boolize("0"))
  assertFalse(_internals.boolize("no"))
  assert(_internals.boolize("1"))
  assert(_internals.boolize("yes"))

  assert(_internals.initialized())
})

Deno.test("useConfig empty PKGX_DIR is ignored", () => {
  assertEquals(ConfigDefault({ PKGX_DIR: "" }).prefix, Path.home().join(".pkgx"))
  assertEquals(ConfigDefault({ PKGX_DIR: "   " }).prefix, Path.home().join(".pkgx"))
  assertEquals(ConfigDefault({ PKGX_DIR: " /  " }).prefix, Path.root)
  assertThrows(() => ConfigDefault({ PKGX_DIR: " foo  " }))
  assertThrows(() => ConfigDefault({ PKGX_DIR: "foo" }))
})

Deno.test("useConfig empty PKGX_PANTRY_PATH is ignored", () => {
  assertEquals(ConfigDefault({ PKGX_PANTRY_PATH: "" }).pantries, [])
  assertEquals(ConfigDefault({ PKGX_PANTRY_PATH: "  : :" }).pantries, [])
})
