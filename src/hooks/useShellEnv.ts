import { Installation } from "../types.ts"
import useConfig from "./useConfig.ts"
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
  'TEA_PREFIX',
  'ACLOCAL_PATH'
] as const
export type EnvKey = typeof EnvKeys[number]

interface Options {
  installations: Installation[]
}

export default function() {
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
      console.warn("warning: env is being duped:", installation.pkg.project)
    }

    for (const key of EnvKeys) {
      for (const suffix of suffixes(key)!) {
        vars[key] = compact_add(vars[key], installation.path.join(suffix).chuzzle()?.string)
      }
    }

    if (archaic) {
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
    const runtime = await usePantry().project(installation.pkg).runtime.env(installation.pkg.version)
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

  if (isMac) {
    // required to link to our libs
    // tea.xyz/gx/cc automatically adds this, but use of any other compilers will not
    rv["LDFLAGS"] = [`-Wl,-rpath,${useConfig().prefix}`]
  }

  // don’t break `man` lol
  rv["MANPATH"]?.push("/usr/share/man")

  return rv
}

function suffixes(key: EnvKey) {
  switch (key) {
    case 'PATH':
      return ["bin", "sbin"]
    case 'MANPATH':
      return ["share/man"]
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
    case 'TEA_PREFIX':
    case 'ACLOCAL_PATH':
      return []  // we handle these specially
    default: {
      const exhaustiveness_check: never = key
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
  }}
}

export function expand(env: Record<string, string[]>) {
  let rv = ''
  for (const [key, value] of Object.entries(env)) {
    if (value.length == 0) continue
    rv += `export ${key}="${value.join(":")}"\n`
  }
  return rv
}

export function flatten(env: Record<string, string[]>) {
  const rv: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    rv[key] = value.join(":")
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
