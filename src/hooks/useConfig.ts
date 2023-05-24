import host from "../utils/host.ts"
import { flatmap } from "../utils/misc.ts";
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

  git?: Path
}

export function ConfigDefault(env = Deno.env.toObject()): Config {
  const prefix = flatmap(env['TEA_PREFIX'], x => new Path(x)) ?? Path.home().join('.tea')
  const pantries = env['TEA_PANTRY_PATH']?.split(":").map(x => Path.cwd().join(x)) ?? []
  const cache = Path.abs(env['TEA_CACHE_DIR']) ?? prefix.join('tea.xyz/var/www')
  const isCI = boolize(env['CI']) ?? false
  const compression = !isCI && host().platform == 'darwin' ? 'xz' : 'gz'
  return {
    prefix,
    pantries,
    cache,
    UserAgent: `tea.lib/0.1.0`, //FIXME version
    options: {
      compression,
    },
    git: git(prefix, env.PATH)
  }
}

export default function useConfig(input?: Config): Config {
  if (!config || input) {
    config = input ?? ConfigDefault()
  }
  return {...config}  // copy to prevent mutation
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

export const _internals = { reset, initialized, boolize }


/// we support a tea installed or system installed git, nothing else
/// eg. `git` could be a symlink in `PATH` to tea, which would cause a fork bomb
/// on darwin if xcode or xcode/clt is not installed this will fail to our http fallback above
//TODO be able to use our own git if installed
//NOTE however we don’t want to have to fully hydrate its env when libtea is initialized only when needed so…
function git(_prefix: Path, PATH?: string): Path | undefined {
  return usr()

  function usr() {
    // only return /usr/bin if in the PATH so user can explicitly override this
    const rv = PATH?.split(":")?.includes("/usr/bin") ? new Path("/usr") : undefined

    /// don’t cause macOS to abort and then prompt the user to install the XcodeCLT
    //FIXME test! but this is hard to test without docker images or something!
    if (host().platform == 'darwin') {
      if (new Path("/Library/Developer/CommandLineTools/usr/bin/git").isExecutableFile()) return rv
      if (new Path("/Application/Xcode.app").isDirectory()) return rv
      return  // don’t use `git`
    }

    return rv?.join("bin/git")
  }
}
