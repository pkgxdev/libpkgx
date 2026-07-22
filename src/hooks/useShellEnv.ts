import type { Installation } from "../types.ts"
import usePantry from "./usePantry.ts"
import host from "../utils/host.ts"

export const EnvKeys = [
  'PATH',
  'MANPATH',
  'PKG_CONFIG_PATH',
  'LIBRARY_PATH',
  'LD_LIBRARY_PATH',
  'CPATH',
  'XDG_DATA_DIRS',
  'CMAKE_PREFIX_PATH',
  'DYLD_FALLBACK_LIBRARY_PATH',
  'SSL_CERT_FILE',
  'LDFLAGS',
  'PKGX_DIR',
  'ACLOCAL_PATH'
] as const
export type EnvKey = typeof EnvKeys[number]

/// Projects whose `lib/` MUST NOT be auto-added to LIBRARY_PATH /
/// LD_LIBRARY_PATH for consumers, because their `lib/` *is* the libc
/// (libc.so.6, libm.so.6, ld-linux*.so) — adding it to consumers'
/// dynamic-linker search path forces every executable in the same
/// pkgx env to load this bottle's libc, which fails the moment the
/// host's own ld-linux is older than what the bottle's libc requires.
///
/// This set lists projects that legitimately ship libc itself. It is
/// intentionally small and hardcoded; long-term the per-package opt
/// should be expressed in the bottle's own metadata so the pantry
/// doesn't need a coordinated libpkgx release for new entries.
const NO_LIB_EXPORT: ReadonlySet<string> = new Set([
  'gnu.org/glibc',
])

interface Options {
  installations: Installation[]
}

export default function(): {
  map: (opts: Options) => Promise<Record<string, string[]>>
  expand: (env: Record<string, string[]>) => string
  flatten: (env: Record<string, string[]>) => Record<string, string>
} {
  return {
    map,
    expand,
    flatten
  }
}

/// returns an environment that supports the provided packages
async function map({installations}: Options): Promise<Record<string, string[]>> {
  const vars: Partial<Record<EnvKey, OrderedSet<string>>> = {}
  const isMac = host().platform == 'darwin'

  const projects = new Set(installations.map(x => x.pkg.project))
  const has_cmake = projects.has('cmake.org')
  const archaic = true

  const rv: Record<string, string[]> = {}
  const seen = new Set<string>()

  for (const installation of installations) {

    if (!seen.insert(installation.pkg.project).inserted) {
      console.warn("pkgx: env is being duped:", installation.pkg.project)
    }

    for (const key of EnvKeys) {
      for (const suffix of suffixes(key)!) {
        vars[key] = compact_add(vars[key], installation.path.join(suffix).chuzzle()?.string)
      }
    }

    // libc-style projects (see NO_LIB_EXPORT) MUST NOT have their
    // lib/ added to LIBRARY_PATH / LD_LIBRARY_PATH: adding a glibc
    // bottle's lib/ to LD_LIBRARY_PATH would force every executable
    // in the same pkgx env to load THIS bottle's libc.so.6, which
    // breaks on hosts whose own ld-linux is older than the bottle's
    // libc requires. Also skip the CPATH/include auto-add for the
    // same reason (compile-time vs runtime libc skew).
    if (archaic && !NO_LIB_EXPORT.has(installation.pkg.project)) {
      vars.LIBRARY_PATH = compact_add(vars.LIBRARY_PATH, installation.path.join("lib").chuzzle()?.string)
      vars.CPATH = compact_add(vars.CPATH, installation.path.join("include").chuzzle()?.string)
    }

    if (has_cmake) {
      vars.CMAKE_PREFIX_PATH = compact_add(vars.CMAKE_PREFIX_PATH, installation.path.string)
    }

    if (projects.has('gnu.org/autoconf')) {
      vars.ACLOCAL_PATH = compact_add(vars.ACLOCAL_PATH, installation.path.join("share/aclocal").chuzzle()?.string)
    }

    if (installation.pkg.project === 'openssl.org') {
      const certPath = installation.path.join("ssl/cert.pem").chuzzle()?.string
      // this is a single file, so we assume a
      // valid entry is correct
      if (certPath) {
        vars.SSL_CERT_FILE = new OrderedSet()
        vars.SSL_CERT_FILE.add(certPath)
      }
    }

    // pantry configured runtime environment
    const runtime = await usePantry().project(installation.pkg).runtime.env(installation.pkg.version, installations)
    for (const key in runtime) {
      rv[key] ??= []
      rv[key].push(runtime[key])
    }
  }

   // this is how we use precise versions of libraries
   // for your virtual environment
   //FIXME SIP on macOS prevents DYLD_FALLBACK_LIBRARY_PATH from propagating to grandchild processes
   if (vars.LIBRARY_PATH) {
    vars.LD_LIBRARY_PATH = vars.LIBRARY_PATH
    if (isMac) {
      // non FALLBACK variety causes strange issues in edge cases
      // where our symbols somehow override symbols from the macOS system
      vars.DYLD_FALLBACK_LIBRARY_PATH = vars.LIBRARY_PATH
    }
  }

  for (const key of EnvKeys) {
    //FIXME where is this `undefined` __happening__?
    if (vars[key] === undefined || vars[key]!.isEmpty()) continue
    rv[key] = vars[key]!.toArray()
  }

  // don’t break `man` lol
  rv["MANPATH"]?.push("/usr/share/man")
  // https://github.com/pkgxdev/libpkgx/issues/70
  rv['XDG_DATA_DIRS']?.push('/usr/local/share:/usr/share')

  return rv
}

function suffixes(key: EnvKey) {
  switch (key) {
    case 'PATH':
      return ["bin", "sbin"]
    case 'MANPATH':
      return ["man", "share/man"]
    case 'PKG_CONFIG_PATH':
      return ['share/pkgconfig', 'lib/pkgconfig']
    case 'XDG_DATA_DIRS':
      return ['share']
    case 'LIBRARY_PATH':
    case 'LD_LIBRARY_PATH':
    case 'DYLD_FALLBACK_LIBRARY_PATH':
    case 'CPATH':
    case 'CMAKE_PREFIX_PATH':
    case 'SSL_CERT_FILE':
    case 'LDFLAGS':
    case 'PKGX_DIR':
    case 'ACLOCAL_PATH':
      return []  // we handle these specially
    default: {
      const exhaustiveness_check: never = key
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
  }}
}

export function expand(env: Record<string, string[]>): string {
  let rv = ''
  for (const [key, value] of Object.entries(env)) {
    if (value.length == 0) continue
    rv += `export ${key}="${value.join(":")}"\n`
  }
  return rv
}

export function flatten(env: Record<string, string[]>): Record<string, string> {
  const SEP = Deno.build.os == 'windows' ? ';' : ':'
  const rv: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    rv[key] = value.join(SEP)
  }
  return rv
}

function compact_add<T>(set: OrderedSet<T> | undefined, item: T | null | undefined): OrderedSet<T> {
  if (!set) set = new OrderedSet<T>()
  if (item) set.add(item)

  return set
}

class OrderedSet<T> {
  private items: T[];
  private set: Set<T>;

  constructor() {
    this.items = [];
    this.set = new Set();
  }

  add(item: T): void {
    if (!this.set.has(item)) {
      this.items.push(item);
      this.set.add(item);
    }
  }

  toArray(): T[] {
    return [...this.items];
  }

  isEmpty(): boolean {
    return this.items.length == 0
  }
}
