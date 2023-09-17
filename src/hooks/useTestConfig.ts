import useConfig, { ConfigDefault } from "./useConfig.ts"
import Path from "../utils/Path.ts"

export function useTestConfig(env?: Record<string, string>) {
  env ??= {}

  /// always prefer a new prefix
  env.TEA_DIR ??= Path.mktemp().string

  /// reuse these unless the test overrides them to speed up testing
  const config = ConfigDefault()
  env.TEA_CACHE_DIR ??= config.cache.string
  env.TEA_PANTRY_PATH ??= config.prefix.join("tea.xyz/var/pantry").string

  return useConfig(ConfigDefault(env))
}
