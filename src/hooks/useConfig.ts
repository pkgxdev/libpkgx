import { flatmap } from "../utils/misc.ts"
import { deno } from "../deps.ts"
import host from "../utils/host.ts"
import Path from "../utils/Path.ts"

export interface Config {
  prefix: Path
  pantries: Path[]
  cache: Path
  data: Path

  dist: string

  options: {
    /// prefer xz or gz for bottle downloads
    compression: 'xz' | 'gz'
  }

  UserAgent?: string

  git?: Path
}

function platform_cache_default(home: Path, { LOCALAPPDATA }: { LOCALAPPDATA?: string }) {
  switch (Deno.build.os) {
  case 'darwin':
    return home.join('Library/Caches')
  case 'windows':
    return flatmap(LOCALAPPDATA, Path.abs) ?? home.join('AppData/Local')
  default:
    return home.join('.cache')
  }
}

function platform_data_home_default(home: Path, { LOCALAPPDATA }: { LOCALAPPDATA?: string }) {
  switch (host().platform) {
  case 'darwin':
    return home.join("Library/Application Support")
  case 'windows': {
    if (LOCALAPPDATA) {
      return new Path(LOCALAPPDATA)
    } else {
      return home.join("AppData/Local")
    }}
  default:
    return home.join(".local/share")
  }
}

const SEP = Deno.build.os == 'windows' ? ';' : ':'

export function ConfigDefault(env = Deno.env.toObject()): Config {
  const home = flatmap(env['PKGX_HOME'], x => new Path(x)) ?? Path.home()
  const prefix = flatmap(env['PKGX_DIR']?.trim(), x => new Path(x)) ?? home.join('.pkgx')
  const pantries = env['PKGX_PANTRY_PATH']?.split(SEP).compact(x => flatmap(x.trim(), x => Path.abs(x) ?? Path.cwd().join(x))) ?? []
  const cache = (flatmap(env["XDG_CACHE_HOME"], Path.abs) ?? platform_cache_default(home, env)).join("pkgx")
  const data = (flatmap(env["XDG_DATA_HOME"], Path.abs) ?? platform_data_home_default(home, env)).join("pkgx")
  const dist = env['PKGX_DIST_URL']?.trim() ?? 'https://dist.pkgx.dev'
  const isCI = boolize(env['CI']) ?? false
  const UserAgent = flatmap(getv(), v => `libpkgx/${v}`) ?? 'libpkgx'
  //TODO prefer 'xz' on Linux (as well) if supported
  const compression = !isCI && host().platform == 'darwin' ? 'xz' : 'gz'

  return {
    prefix,
    pantries,
    cache,
    data,
    dist,
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

    return (() => {
      /// don’t cause macOS to abort and then prompt the user to install the XcodeCLT
      //FIXME test! but this is hard to test without docker images or something!
      switch (host().platform) {
      case 'darwin':
        if (new Path("/Library/Developer/CommandLineTools/usr/bin/git").isExecutableFile()) return rv
        if (new Path("/Applications/Xcode.app").isDirectory()) return rv
        return  // probably won’t work without prompting the user to install the XcodeCLT
      case "linux":
        return rv
      case "windows":
        if (PATH) {
          //FIXME this is GitHub Actions specific
          return new Path('C:\Program Files\Git\cmd\git.exe')
        }
      }
    })()?.join("bin/git")
  }
}
