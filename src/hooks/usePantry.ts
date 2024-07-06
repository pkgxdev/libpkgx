import { is_what, PlainObject } from "../deps.ts"
const { isNumber, isPlainObject, isString, isArray, isPrimitive, isBoolean } = is_what
import { Package, Installation, PackageRequirement } from "../types.ts"
import { provides as cache_provides, available as cache_available, runtime_env as cache_runtime_env, companions as cache_companions, dependencies as cache_dependencies } from "./useSyncCache.ts";
import SemVer, * as semver from "../utils/semver.ts"
import useMoustaches from "./useMoustaches.ts"
import { PkgxError } from "../utils/error.ts"
import { validate } from "../utils/misc.ts"
import * as pkgutils from "../utils/pkg.ts"
import useConfig from "./useConfig.ts"
import host from "../utils/host.ts"
import Path from "../utils/Path.ts"

export interface Interpreter {
  project: string // FIXME: should probably be a stronger type
  args: string[]
}

export class PantryError extends PkgxError
{}

export class PantryParseError extends PantryError {
  project: string
  path?: Path

  constructor(project: string, path?: Path, cause?: unknown) {
    super(`package.yml parse error: ${path ?? project}`)
    this.project = project
    this.path = path
    this.cause = cause
  }
}

export class PackageNotFoundError extends PantryError {
  project: string
  constructor(project: string) {
    super(`pkg not found: ${project}`)
    this.project = project
  }
}

export class PantryNotFoundError extends PantryError {
  constructor(path: Path) {
    super(`pantry not found: ${path}`)
  }
}

export default function usePantry() {
  const prefix = useConfig().data.join("pantry/projects")
  const is_cache_available = cache_available() && pantry_paths().length == 1

  async function* ls(): AsyncGenerator<LsEntry> {
    const seen = new Set()

    for (const prefix of pantry_paths()) {
      for await (const path of _ls_pantry(prefix)) {
        const project = path.parent().relative({ to: prefix })
        if (seen.insert(project).inserted) {
          yield { project, path }
        }
      }
    }
  }

  const project = (input: string | { project: string }) => {
    const project = isString(input) ? input : input.project

    const yaml = (() => {
      for (const prefix of pantry_paths()) {
        if (!prefix.exists()) throw new PantryNotFoundError(prefix.parent())
        const dir = prefix.join(project)
        const filename = dir.join("package.yml")
        if (!filename.exists()) continue

        let memo: Promise<PlainObject> | undefined

        return () => memo ?? (memo = filename.readYAML()
          .then(validate.obj)
          .catch(cause => { throw new PantryParseError(project, filename, cause) }))
      }
      throw new PackageNotFoundError(project)
    })()

    const companions = async () => {
      if (is_cache_available) {
        return await cache_companions(project) ?? parse_pkgs_node((await yaml())["companions"])
      } else {
        return parse_pkgs_node((await yaml())["companions"])
      }
    }

    const runtime_env = async (version: SemVer, deps: Installation[]) => {
      const obj = await (async () => {
        if (is_cache_available) {
          const cached = await cache_runtime_env(project)
          if (cached) return cached
        }
        const yml = await yaml()
        return validate.obj(yml["runtime"]?.["env"] ?? {})
      })()
      return expand_env_obj(obj, { project, version }, deps)
    }

    const available = async (): Promise<boolean> => {
      let { platforms } = await yaml()
      if (!platforms) return true
      if (isString(platforms)) platforms = [platforms]
      if (!isArray(platforms)) throw new PantryParseError(project)
      return platforms.includes(host().platform) ||platforms.includes(`${host().platform}/${host().arch}`)
    }

    const drydeps = async () => {
      if (is_cache_available) {
        return await cache_dependencies(project) ?? parse_pkgs_node((await yaml()).dependencies)
      } else {
        return parse_pkgs_node((await yaml()).dependencies)
      }
    }

    const provides = async () => {
      let node = (await yaml())["provides"]
      if (!node) return []
      if (isPlainObject(node)) {
        node = node[host().platform]
      }
      if (!isArray(node)) throw new PantryParseError(project)

      return node.compact(x => {
        if (isPlainObject(x)) {
          x = x["executable"]
        }
        if (isString(x)) {
          if (x.startsWith("bin/")) return x.slice(4)
          if (x.startsWith("sbin/")) return x.slice(5)
        }
      })
    }

    const provider = async () => {
      for (const prefix of pantry_paths()) {
        if (!prefix.exists()) continue
        const dir = prefix.join(project)
        const filename = dir.join("provider.yml")
        if (!filename.exists()) continue
        const yaml = validate.obj(await filename.readYAML())
        const cmds = validate.arr<string>(yaml.cmds)
        return (binname: string) => {
          if (!cmds.includes(binname)) return
          const args = yaml['args']
          if (isPlainObject(args)) {
            if (args[binname]) {
              return get_args(args[binname])
            } else {
              return get_args(args['...'])
            }
          } else {
            return get_args(args)
          }
        }
      }
      function get_args(input: unknown) {
        if (isString(input)) {
          return input.split(/\s+/)
        } else {
          return validate.arr<string>(input)
        }
      }
    }

    return {
      companions,
      runtime: {
        env: runtime_env,
        deps: drydeps
      },
      available,
      provides,
      provider,
      yaml
    }
  }

  /// finds a project that matches the input string on either name, display-name or FQD project name
  /// - Returns: Project[] since there may by multiple matches, if you want a single match you should use `project()`
  async function find(name: string) {
    type Foo = ReturnType<typeof project> & LsEntry

    //lol FIXME
    name = pkgutils.parse(name).project

    if (prefix.join(name).isDirectory()) {
      const foo = project(name)
      return [{...foo, project: name }]
    }

    /// only use cache if PKGX_PANTRY_PATH is not set
    if (is_cache_available) {
      const cached = await cache_provides(name)
      if (cached?.length) {
        return cached.map(x => ({
          ...project(x),
          project: x
        }))
      }

      // else we need to still check for display-names
    }

    name = name.toLowerCase()

    //TODO not very performant due to serial awaits
    const rv: Foo[] = []
    for await (const pkg of ls()) {
      const proj = {...project(pkg.project), ...pkg}
      if (pkg.project.toLowerCase() == name) {
        rv.push(proj)
        continue
      }
      const yaml = await proj.yaml().swallow()
      if (!yaml) {
        console.warn("warn: parse failure:", pkg.project)
      } else if (yaml["display-name"]?.toLowerCase() == name) {
        rv.push(proj)
      } else if ((await proj.provides()).map(x => x.toLowerCase()).includes(name)) {
        rv.push(proj)
      }
    }
    return rv
  }

  async function which({ interprets: extension }: { interprets: string }): Promise<Interpreter | undefined> {
    if (extension[0] == '.') extension = extension.slice(1)
    if (!extension) return
    for await (const pkg of ls()) {
      const yml = await project(pkg).yaml()
      const node = yml["interprets"]
      if (!isPlainObject(node)) continue
      try {
        const { extensions, args } = yml["interprets"]
        if ((isString(extensions) && extensions === extension) ||
          (isArray(extensions) && extensions.includes(extension))) {
          return { project: pkg.project, args: isArray(args) ? args : [args] }
        }
      } catch {
        continue
      }
    }
    return undefined
  }

  const missing = () => {
    try {
      return !pantry_paths().some(x => x.exists())
    } catch (e) {
      if (e instanceof PantryNotFoundError) {
        return true
      } else {
        throw e
      }
    }
  }

  const neglected = () => {
    const last_sync_file = prefix.join(".last_sync")
    if (!last_sync_file.exists()) return true
    const last_sync_date = new Date(Deno.readTextFileSync(last_sync_file.string).trim());
    if (!last_sync_date) return true
    return (Date.now() - last_sync_date.getTime()) > 24 * 60 * 60 * 1000
  }

  return {
    prefix,
    which,
    ls,
    project,
    find,
    parse_pkgs_node,
    expand_env_obj,
    missing,
    neglected,
    pantry_paths
  }

  function pantry_paths(): Path[] {
    const rv: Path[] = []

    if (prefix.isDirectory()) {
      rv.push(prefix)
    }
    for (const path of useConfig().pantries.reverse()) {
      rv.unshift(path.join("projects"))
    }

    if (rv.length == 0) {
      throw new PantryNotFoundError(prefix)
    }

    return rv
  }
}

// deno-lint-ignore no-explicit-any
export function parse_pkgs_node(node: any) {
  if (!node) return []
  node = validate.obj(node)
  platform_reduce(node)

  return Object.entries(node)
    .compact(([project, constraint]) =>
      validatePackageRequirement(project, constraint))
}

export function validatePackageRequirement(project: string, constraint: unknown): PackageRequirement {
  if (isNumber(constraint)) {
    constraint = `^${constraint}`
  } else if (!isString(constraint)) {
    throw new Error(`invalid constraint for ${project}: ${constraint}`)
  }

  constraint = semver.Range.parse(constraint as string)
  if (!constraint) {
    throw new PkgxError("invalid constraint for " + project + ": " + constraint)
  }

  return {
    project,
    constraint: constraint as semver.Range
  }
}

/// expands platform specific keys into the object
/// expands inplace because JS is nuts and you have to suck it up
function platform_reduce(env: PlainObject) {
  const sys = host()
  for (const [key, value] of Object.entries(env)) {
    const [os, arch] = (() => {
      let match = key.match(/^(darwin|linux)\/(aarch64|x86-64)$/)
      if (match) return [match[1], match[2]]
      if ((match = key.match(/^(darwin|linux)$/))) return [match[1]]
      if ((match = key.match(/^(aarch64|x86-64)$/))) return [,match[1]]
      return []
    })()

    if (!os && !arch) continue
    delete env[key]
    if (os && os != sys.platform) continue
    if (arch && arch != sys.arch) continue

    const dict = validate.obj(value)
    for (const [key, value] of Object.entries(dict)) {
      // if user specifies an array then we assume we are supplementing
      // otherwise we are replacing. If this is too magical let us know
      if (isArray(value)) {
        if (!env[key]) env[key] = []
        else if (!isArray(env[key])) env[key] = [env[key]]
        //TODO if all-platforms version comes after the specific then order accordingly
        env[key].push(...value)
      } else {
        env[key] = value
      }
    }
  }
}

export function expand_env_obj(env_: PlainObject, pkg: Package, deps: Installation[]): Record<string, string> {
  const env = {...env_}

  platform_reduce(env)

  const rv: Record<string, string> = {}

  for (let [key, value] of Object.entries(env)) {
    if (isArray(value)) {
      value = value.map(x => transform(x)).join(" ")
    } else {
      value = transform(value)
    }

    if (Deno.build.os == 'windows') {
      // we standardize on UNIX directory separators
      // NOTE hopefully this won’t break anything :/
      value = value.replaceAll('/', '\\')
    }

    rv[key] = value
  }

  return rv

  // deno-lint-ignore no-explicit-any
  function transform(value: any): string {
    if (!isPrimitive(value)) throw new PantryParseError(pkg.project, undefined, JSON.stringify(value))

    if (isBoolean(value)) {
      return value ? "1" : "0"
    } else if (value === undefined || value === null) {
      return "0"
    } else if (isString(value)) {
      const mm = useMoustaches()
      const home = Path.home().string
      const obj = [
        { from: 'home', to: home }       // remove, stick with just ~
      ]
      obj.push(...mm.tokenize.all(pkg, deps))
      return mm.apply(value, obj)
    } else if (isNumber(value)) {
      return value.toString()
    }

    const e = new Error("unexpected error")
    e.cause = value
    throw e
  }
}

interface LsEntry {
  project: string
  path: Path
}

async function* _ls_pantry(dir: Path): AsyncGenerator<Path> {
  if (!dir.isDirectory()) throw new PantryNotFoundError(dir)

  for await (const [path, { name, isDirectory }] of dir.ls()) {
    if (isDirectory) {
      for await (const x of _ls_pantry(path)) {
        yield x
      }
    } else if (name === "package.yml" || name === "package.yaml") {
      yield path
    }
  }
}
