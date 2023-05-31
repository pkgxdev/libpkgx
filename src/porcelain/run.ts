import install, { Logger } from "../plumbing/install.ts"
import useShellEnv from '../hooks/useShellEnv.ts'
import usePantry from '../hooks/usePantry.ts'
import * as semver from "../utils/semver.ts"
import hydrate from "../plumbing/hydrate.ts"
import resolve from "../plumbing/resolve.ts"
import { spawn } from "node:child_process"
import useSync from "../hooks/useSync.ts"
import link from "../plumbing/link.ts"
import Path from "../utils/Path.ts"
import { isArray } from "is-what"

interface OptsEx {
  env?: Record<string, string | undefined>
  logger?: Logger
}

type Options = {
  stdout?: boolean
  stderr?: boolean
  status?: boolean
} & OptsEx

type Cmd = string | (string | Path)[]

/// if you pass a single string we call that string via /bin/sh
/// if you don’t want that pass an array of args
export default async function run(cmd: Cmd, opts?: OptsEx): Promise<void>;
export default async function run(cmd: Cmd, opts: {stdout: true} & OptsEx): Promise<{ stdout: string }>;
export default async function run(cmd: Cmd, opts: {stderr: true} & OptsEx): Promise<{ stderr: string }>;
export default async function run(cmd: Cmd, opts: {status: true} & OptsEx): Promise<{ status: number }>;
export default async function run(cmd: Cmd, opts: {stdout: true, stderr: true} & OptsEx): Promise<{ stdout: string, stderr: string }>;
export default async function run(cmd: Cmd, opts: {stdout: true, status: true} & OptsEx): Promise<{ stdout: string, status: number }>;
export default async function run(cmd: Cmd, opts: {stderr: true, status: true} & OptsEx): Promise<{ stderr: string, status: number }>;
export default async function run(cmd: Cmd, opts: {stdout: true, stderr: true, status: true } & OptsEx): Promise<{ stdout: string, stderr: string, status: number }>;
export default async function run(cmd: Cmd, opts?: Options): Promise<void|{ stdout?: string|undefined; stderr?: string|undefined; status?: number|undefined; }> {
  const [arg0, [spawn0, args]] = (() => {
    if (isArray(cmd)) {
      if (cmd.length == 0) {
        throw new RunError('EUSAGE', `\`cmd\` evaluated empty: ${cmd}`)
      }
      const arg0 = cmd.shift()!.toString()
      return [arg0, [arg0, cmd.map(x => x.toString())]]
    } else {
      const s = cmd.trim()
      const i = s.indexOf(' ')
      return [s.slice(0, i), ['/bin/sh', ['-c', cmd]]]
    }
  })()

  const env = await setup(arg0, opts?.env ?? Deno.env.toObject(), opts?.logger)

  return new Promise((resolve, reject) => {
    const proc = spawn(spawn0, args, {
      env,
      stdio: [
        "pipe",
        opts?.stdout ? 'pipe' : 'inherit',
        opts?.stderr ? 'pipe' : 'inherit'
      ]
    })

    let stdout = '', stderr = ''
    proc.stdout?.on('data', data => stdout += data)
    proc.stderr?.on('data', data => stderr += data)
    proc.on('close', status => {
      if (status && !opts?.status) {
        const err = new RunError('EIO', `${cmd} exited with: ${status}`)
        err.cause = status
        reject(err)
      } else {
        const fulfill = resolve as ({}) => void
        fulfill({ stdout, stderr, status })
      }
    })
  })
}

async function setup(cmd: string, env: Record<string, string | undefined>, logger: Logger | undefined) {
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


type RunErrorCode = 'ENOENT' | 'EUSAGE' | 'EIO'

class RunError extends Error {
  code: RunErrorCode

  constructor(code: RunErrorCode, message: string) {
    super(message)
    this.code = code
  }
}
