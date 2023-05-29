import node, { SpawnOptions, ExecOptions } from "node:child_process"
import useShellEnv from '../hooks/useShellEnv.ts'
import usePantry from '../hooks/usePantry.ts'
import * as semver from "../utils/semver.ts"
import useSync from "../hooks/useSync.ts"
import Path from "../utils/Path.ts"
import hydrate from "./hydrate.ts"
import resolve from "./resolve.ts"
import install from "./install.ts"
import link from "./link.ts"

async function setup(cmd: string, env: Record<string, string | undefined> | undefined) {
  const pantry = usePantry()
  const sh = useShellEnv()

  if (pantry.missing() || pantry.neglected()) {
    useSync()
  }

  const project = await (async () => {
    for await (const { project } of pantry.ls()) {
      const provides = await pantry.project(project).provides()
      //TODO handle eg. node^16 here
      if (provides.includes(cmd)) {
        return project
      }
    }
    throw new RunError('ENOENT', `No project in pantry provides ${cmd}`)
  })()

  const { pkgs } = await hydrate({ project, constraint: new semver.Range('*') })
  const { pending, installed } = await resolve(pkgs)
  for (const pkg of pending) {
    const installation = await install(pkg)
    await link(installation)
    installed.push(installation)
  }

  const pkgenv = await sh.map({ installations: installed })

  if (env) for (const [key, value] of Object.entries(env)) {
    if (!value) {
      continue
    } else if (env[key]) {
      pkgenv[key].push(value)
    } else {
      pkgenv[key] = [value]
    }
  }

  return sh.flatten(pkgenv)
}

export async function spawn(cmd: string, args: (string | Path)[] = [], opts?: SpawnOptions) {
  const env = await setup(cmd, opts?.env)
  opts ??= {}
  opts.env = env
  return node.spawn(cmd[0], args.map(x=>x.toString()), opts)
}

export async function exec(cmd: string, opts?: ExecOptions) {
  cmd = cmd.trim()
  const pivot = cmd.indexOf(' ')
  const arg0 = cmd.slice(0, pivot)
  const env = await setup(arg0, opts?.env)
  opts ??= {}
  opts.env = env
  return node.exec(arg0, opts)
}

export default { spawn, exec }



type RunErrorCode = 'ENOENT' | 'EUSAGE'

class RunError extends Error {
  code: RunErrorCode

  constructor(code: RunErrorCode, message: string) {
    super(message)
    this.code = code
  }
}
