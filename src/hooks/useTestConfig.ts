import useConfig, { ConfigDefault } from "./useConfig.ts"
import Path from "../utils/Path.ts"

export function useTestConfig(env?: Record<string, string>) {
  env ??= {}

  /// always prefer a new prefix
  env.TEA_PREFIX ??= Path.mktemp().string

  /// reuse these unless the test overrides them to speed up testing
  env.TEA_CACHE_DIR ??= Path.home().join(".tea/tea.xyz/var/www").string
  env.TEA_PANTRY_PATH ??= Path.home().join(".tea/tea.xyz/var/pantry").string

  return useConfig(ConfigDefault(env))
}
