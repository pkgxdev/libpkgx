import { spawn as node_spawn, SpawnOptions } from "node:child_process"
import useShellEnv from '../hooks/useShellEnv.ts'
import usePantry from '../hooks/usePantry.ts'
import * as semver from "../utils/semver.ts"
import useSync from "../hooks/useSync.ts"
import Path from "../utils/Path.ts"
import hydrate from "./hydrate.ts"
import { isString } from 'is-what'
import resolve from "./resolve.ts"
import install from "./install.ts"
import link from "./link.ts"

export async function spawn(cmd: string | string[] | Path[], opts: SpawnOptions) {
  const pantry = usePantry()
  const sh = useShellEnv()

  cmd = isString(cmd) ? cmd.split(' ') : cmd.map(x => `${x}`)
  if (cmd.length === 0) throw new RunError('EUSAGE', '`cmd` cannot be empty')
  const arg0 = cmd[0]

  if (pantry.needsUpdate()) {
    useSync()
  }

  const project = await (async () => {
    for await (const { project } of pantry.ls()) {
      const provides = await pantry.project(project).provides()
      //TODO handle eg. node^16 here
      if (provides.includes(arg0)) {
        return project
      }
    }
    throw new RunError('ENOENT', `No project in pantry provides ${arg0}`)
  })()

  const { pkgs } = await hydrate({ project, constraint: new semver.Range('*') })
  const { pending, installed } = await resolve(pkgs)
  for (const pkg of pending) {
    const installation = await install(pkg)
    await link(installation)
    installed.push(installation)
  }

  const env = await sh.map({ installations: installed })

  for (const [key, value] of Object.entries(opts.env ?? {})) {
    if (!value) {
      continue
    } else if (env[key]) {
      env[key].push(value)
    } else {
      env[key] = [value]
    }
  }

  opts.env = sh.flatten(env)

  return node_spawn(cmd[0], cmd.slice(1), opts)
}

export default { spawn }



type RunErrorCode = 'ENOENT' | 'EUSAGE'

class RunError extends Error {
  code: RunErrorCode

  constructor(code: RunErrorCode, message: string) {
    super(message)
    this.code = code
  }
}
