import { flatmap } from "../utils/misc.ts"
import { deno } from "../deps.ts"
import host from "../utils/host.ts"
import Path from "../utils/Path.ts"

export interface Config {
  prefix: Path
  pantries: Path[]
  cache: Path
  data: Path

  options: {
    /// prefer xz or gz for bottle downloads
    compression: 'xz' | 'gz'
  }

  UserAgent?: string

  git?: Path
}

function platform_cache_default() {
  switch (Deno.build.os) {
  case 'darwin':
    return Path.home().join('Library/Caches')
  case 'windows':
    return flatmap(Deno.env.get("LOCALAPPDATA"), Path.abs) ?? Path.home().join('AppData/Local')
  default:
    return Path.home().join('.cache')
  }
}

const SEP = Deno.build.os == 'windows' ? ';' : ':'

export function ConfigDefault(env = Deno.env.toObject()): Config {
  const prefix = flatmap(env['PKGX_DIR']?.trim(), x => new Path(x)) ?? Path.home().join('.pkgx')
  const pantries = env['PKGX_PANTRY_PATH']?.split(SEP).compact(x => flatmap(x.trim(), x => Path.abs(x) ?? Path.cwd().join(x))) ?? []
  const cache = (flatmap(env["XDG_CACHE_HOME"], x => new Path(x)) ?? platform_cache_default()).join("pkgx")
  const isCI = boolize(env['CI']) ?? false
  const UserAgent = flatmap(getv(), v => `libpkgx/${v}`) ?? 'libpkgx'

  const data = (() => {
    const xdg = env["XDG_DATA_HOME"]
    if (xdg) {
      return new Path(xdg)
    } else if (host().platform == "darwin") {
      return Path.home().join("Library/Application Support")
    } else {
      return Path.home().join(".local/share")
    }
  })().join("pkgx")

  //TODO prefer 'xz' on Linux (as well) if supported
  const compression = !isCI && host().platform == 'darwin' ? 'xz' : 'gz'

  return {
    prefix,
    pantries,
    cache,
    data,
    UserAgent,
    options: {
      compression,
    },
    git: git(prefix, env.PATH)
  }
}

function getv(): string | undefined {
  if (typeof Deno === 'undefined') {
    const path = new Path(deno.fromFileUrl(import.meta.url)).parent().parent().parent().join("package.json")
    const blob = Deno.readFileSync(path.string)
    const txt = new TextDecoder().decode(blob)
    const { version } = JSON.parse(txt)
    return typeof version == 'string' ? version : undefined
  }
}

const gt = globalThis as unknown as {sh_pkgx_config?: Config}

export default function useConfig(input?: Config): Config {
  // storing on globalThis so our config is shared across
  // potentially multiple versions of libpkgx being loaded in the same process
  if (!gt.sh_pkgx_config || input) {
    gt.sh_pkgx_config = input ?? ConfigDefault()
  }
  return {...gt.sh_pkgx_config}  // copy to prevent mutation
}

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

function initialized() {
  return gt.sh_pkgx_config !== undefined
}

export const _internals = { initialized, boolize }


/// we support a pkgx installed or system installed git, nothing else
/// eg. `git` could be a symlink in `PATH` to pkgx, which would cause a fork bomb
/// on darwin if xcode or xcode/clt is not installed this will fail to our http fallback above
//TODO be able to use our own git if installed
//NOTE however we don’t want to have to fully hydrate its env when libpkgx is initialized only when needed so…
function git(_prefix: Path, PATH?: string): Path | undefined {
  return usr()

  function usr() {
    // only return /usr/bin if in the PATH so user can explicitly override this
    const rv = PATH?.split(":")?.includes("/usr/bin") ? new Path("/usr") : undefined

    /// don’t cause macOS to abort and then prompt the user to install the XcodeCLT
    //FIXME test! but this is hard to test without docker images or something!
    if (host().platform == 'darwin') {
      if (new Path("/Library/Developer/CommandLineTools/usr/bin/git").isExecutableFile()) return rv
      if (new Path("/Applications/Xcode.app").isDirectory()) return rv
      return  // don’t use `git`
    }

    return rv?.join("bin/git")
  }
}
