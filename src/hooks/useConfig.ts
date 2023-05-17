import host from "../utils/host.ts"
import Path from "../utils/Path.ts"

export interface Config {
  prefix: Path
  pantries: Path[]
  cache: Path

  options: {
    /// prefer xz or gz for bottle downloads
    compression: 'xz' | 'gz'
  }

  UserAgent?: string
}

export function ConfigDefault(env = Deno.env.toObject()): Config {
  const prefix = Path.abs(env['TEA_PREFIX']) ?? Path.home().join('.tea')
  const pantries = env['TEA_PANTRY_PATH']?.split(":").map(x => Path.cwd().join(x)) ?? []
  const isCI = boolize(env['CI']) ?? false
  const compression = !isCI && host().platform == 'darwin' ? 'xz' : 'gz'
  return {
    prefix,
    pantries,
    cache: prefix.join('tea.xyz/var/www'),
    UserAgent: `tea.lib/0.1.0`, //FIXME version
    options: {
      compression,
    },
  }
}

export default function useConfig(input?: Config): Config {
  if (!config || input) {
    config = input ?? ConfigDefault()
  }
  return config
}

let config: Config | undefined

function boolize(input: string | undefined): boolean | undefined {
  switch (input?.trim()?.toLowerCase()) {
    case '0':
    case 'false':
    case 'no':
      return false
    case '1':
    case 'true':
    case 'yes':
      return true
  }
}

function reset() {
  return config = undefined
}

function initialized() {
  return config !== undefined
}

export const _internals = { reset, initialized }
