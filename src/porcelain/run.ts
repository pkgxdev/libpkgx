import node, { SpawnOptions, ExecOptions } from "node:child_process"
import install, { Logger } from "../plumbing/install.ts"
import useShellEnv from '../hooks/useShellEnv.ts'
import usePantry from '../hooks/usePantry.ts'
import * as semver from "../utils/semver.ts"
import hydrate from "../plumbing/hydrate.ts"
import resolve from "../plumbing/resolve.ts"
import useSync from "../hooks/useSync.ts"
import link from "../plumbing/link.ts"
import { promisify } from "node:util"
import Path from "../utils/Path.ts"

async function setup(cmd: string, env: Record<string, string | undefined> | undefined, logger: Logger | undefined) {
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
    const installation = await install(pkg, logger)
    await link(installation)
    installed.push(installation)
  }

  const pkgenv = await sh.map({ installations: installed })

  env ??= Deno.env.toObject()

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      continue
    } else if (pkgenv[key]) {
      pkgenv[key].push(value)
    } else {
      pkgenv[key] = [value]
    }
  }

  return sh.flatten(pkgenv)
}

export async function spawn(cmd: string, args: (string | Path)[] = [], opts?: SpawnOptions, logger?: Logger) {
  opts ??= {}
  opts.env = await setup(cmd, opts.env, logger)
  return node.spawn(cmd, args.map(x => x.toString()), opts)
}

export async function exec(cmd: string, opts?: ExecOptions, logger?: Logger): Promise<{stdout: string, stderr: string }> {
  cmd = cmd.trim()
  opts ??= {}

  const pivot = cmd.indexOf(' ')
  const arg0 = cmd.slice(0, pivot)
  opts.env = await setup(arg0, opts.env, logger)

  return promisify(node.exec)(cmd, opts)
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
