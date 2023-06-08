import { is_what, PlainObject } from "../deps.ts"
const { isNumber, isPlainObject, isString, isArray, isPrimitive, isBoolean } = is_what
import { validatePackageRequirement } from "../utils/hacks.ts"
import { Package, Installation } from "../types.ts"
import useMoustaches from "./useMoustaches.ts"
import { validate } from "../utils/misc.ts"
import TeaError from "../utils/error.ts"
import SemVer from "../utils/semver.ts"
import useConfig from "./useConfig.ts"
import host from "../utils/host.ts"
import Path from "../utils/Path.ts"

export interface Interpreter {
  project: string // FIXME: should probably be a stronger type
  args: string[]
}

export default function usePantry() {
  const config = useConfig()
  const prefix = config.prefix.join('tea.xyz/var/pantry/projects')

  async function* ls(): AsyncGenerator<LsEntry> {
    for (const prefix of pantry_paths()) {
      for await (const path of _ls_pantry(prefix)) {
        yield {
          project: path.parent().relative({ to: prefix }),
          path
        }
      }
    }
  }

  const project = (input: string | { project: string }) => {
    const project = isString(input) ? input : input.project

    const yaml = (() => {
      for (const prefix of pantry_paths()) {
        if (!prefix.exists()) throw new TeaError('not-found: pantry', { path: prefix.parent() })
        const dir = prefix.join(project)
        const filename = dir.join("package.yml")
        if (!filename.exists()) continue

        let memo: Promise<PlainObject> | undefined

        return () => memo ?? (memo = filename.readYAML()
          .then(validate.obj)
          .catch(cause => { throw new TeaError('parser: pantry: package.yml', {cause, project, filename}) }))
      }
      throw new TeaError('not-found: pantry: package.yml', {project}, )
    })()

    const companions = async () => parse_pkgs_node((await yaml())["companions"])

    const runtime_env = async (version: SemVer, deps: Installation[]) => {
      const yml = await yaml()
      const obj = validate.obj(yml["runtime"]?.["env"] ?? {})
      return expand_env_obj(obj, { project, version }, deps)
    }

    const available = async (): Promise<boolean> => {
      let { platforms } = await yaml()
      if (!platforms) return true
      if (isString(platforms)) platforms = [platforms]
      if (!isArray(platforms)) throw new Error("bad-yaml")
      return platforms.includes(host().platform) ||platforms.includes(`${host().platform}/${host().arch}`)
    }

    const drydeps = async () => parse_pkgs_node((await yaml()).dependencies)

    const provides = async () => {
      let node = (await yaml())["provides"]
      if (!node) return []
      if (isPlainObject(node)) {
        node = node[host().platform]
      }
      if (!isArray(node)) throw new Error("bad-yaml")

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

  const missing = () => !prefix.exists()

  const neglected = () => {
    const stat = Deno.statSync(prefix.string)
    if (!stat.mtime) return true
    return (Date.now() - stat.mtime.getTime()) > 24 * 60 * 60 * 1000
  }

  return {
    prefix,
    which,
    ls,
    project,
    parse_pkgs_node,
    expand_env_obj,
    missing,
    neglected
  }

  function pantry_paths(): Path[] {
    const rv: Path[] = []

    if (prefix.isDirectory()) {
      rv.push(prefix)
    }
    for (const path of config.pantries.reverse()) {
      rv.unshift(path.join("projects"))
    }

    if (rv.length == 0) {
      throw new TeaError("not-found: pantry", {path: prefix})
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

    rv[key] = value
  }

  return rv

  // deno-lint-ignore no-explicit-any
  function transform(value: any): string {
    if (!isPrimitive(value)) throw new Error(`invalid-env-value: ${JSON.stringify(value)}`)

    if (isBoolean(value)) {
      return value ? "1" : "0"
    } else if (value === undefined || value === null) {
      return "0"
    } else if (isString(value)) {
      const mm = useMoustaches()
      const home = Path.home().string
      const obj = [
        { from: 'env.HOME', to: home },  // historic, should be removed at v1
        { from: 'home', to: home }       // remove, stick with just ~
      ]
      obj.push(...mm.tokenize.all(pkg, deps))
      return mm.apply(value, obj)
    } else if (isNumber(value)) {
      return value.toString()
    }
    throw new Error("unexpected-error")
  }
}

interface LsEntry {
  project: string
  path: Path
}

async function* _ls_pantry(dir: Path): AsyncGenerator<Path> {
  if (!dir.isDirectory()) throw new TeaError('not-found: pantry', { path: dir })

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
