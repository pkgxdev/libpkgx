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


  const PKGX_PANTRY_PATH = Deno.build.os == 'windows' ? "C:\\foo;D:\\bar" : "/foo:/bar"

  config = ConfigDefault({ PKGX_PANTRY_PATH, CI: "true" })
  if (Deno.build.os == 'windows') {
    assertEquals(config.pantries.map(x => x.string), ["C:\\foo", "D:\\bar"])
  } else {
    assertEquals(config.pantries.map(x => x.string), ["/foo", "/bar"])
  }
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
  const SEP = Deno.build.os == 'windows' ? ';' : ':'
  assertEquals(ConfigDefault({ PKGX_PANTRY_PATH: "" }).pantries, [])
  assertEquals(ConfigDefault({ PKGX_PANTRY_PATH: `  ${SEP} ${SEP}` }).pantries, [])
})
