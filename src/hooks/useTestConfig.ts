import useConfig, { ConfigDefault } from "./useConfig.ts"
import Path from "../utils/Path.ts"

export function useTestConfig(env?: Record<string, string>) {
  env ??= {}

  /// always prefer a new prefix
  env.HOME ??= Path.mktemp().string
  env.PKGX_DIR ??= Path.mktemp().string
  env.XDG_DATA_HOME ??= Path.mktemp().string
  env.XDG_CACHE_HOME ??= Path.mktemp().string

  return useConfig(ConfigDefault(env))
}
