import { assertEquals } from "deno/testing/asserts.ts"
import { Verbosity } from "../types.ts"
import useConfig from "./useConfig.ts"

Deno.test("useConfig", () => {
  const config = useTestConfig()
  assertEquals(config.UserAgent, "tea.lib/0.1.0")
  assertEquals(config.modifiers.verbosity, Verbosity.normal)
})


import { ConfigDefault } from "./useConfig.ts"
import Path from "../utils/Path.ts"

export function useTestConfig(env?: Record<string, string>) {
  const pantries = [Path.home().join(".tea/tea.xyz/var/pantry")]
  const conf = ConfigDefault(env)

  return useConfig({
    ...conf,
    prefix: Path.mktemp(),
    pantries,
  })
}
