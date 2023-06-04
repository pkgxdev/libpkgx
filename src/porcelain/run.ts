import install, { Logger } from "../plumbing/install.ts"
import useShellEnv from '../hooks/useShellEnv.ts'
import usePantry from '../hooks/usePantry.ts'
import hydrate from "../plumbing/hydrate.ts"
import resolve from "../plumbing/resolve.ts"
import { spawn } from "node:child_process"
import useSync from "../hooks/useSync.ts"
import which from "../plumbing/which.ts"
import link from "../plumbing/link.ts"
import Path from "../utils/Path.ts"
import { is_what } from "../deps.ts"
const { isArray } = is_what

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

  const { usesh, arg0: whom } = (() => {
    if (!isArray(cmd)) {
      const s = cmd.trim()
      const i = s.indexOf(' ')
      const usesh = i >= 0
      const arg0 = s.slice(0, i)
      cmd = s.slice(i + 1)
      return { usesh, arg0 }
    } else if (cmd.length == 0) {
      throw new RunError('EUSAGE', `\`cmd\` evaluated empty: ${cmd}`)
    } else {
      return {
        usesh: false,
        arg0: cmd.shift()!.toString().trim()
      }
    }
  })()

  const { env, shebang } = await setup(whom, opts?.env ?? Deno.env.toObject(), opts?.logger)
  const arg0 = usesh ? '/bin/sh' : shebang.shift()!
  const args = usesh
    ? ['-c', `${shebang.join(' ')} ${cmd}`]
    : [...shebang, ...(cmd as (string | Path)[]).map(x => x.toString())]

  return new Promise((resolve, reject) => {
    const proc = spawn(arg0, args, {
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
    await useSync()
  }

  const wut = await which(cmd)
  if (!wut) throw new RunError('ENOENT', `No project in pantry provides ${cmd}`)

  const { pkgs } = await hydrate(wut)
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

  return { env: sh.flatten(pkgenv), shebang: wut.shebang }
}


type RunErrorCode = 'ENOENT' | 'EUSAGE' | 'EIO'

class RunError extends Error {
  code: RunErrorCode

  constructor(code: RunErrorCode, message: string) {
    super(message)
    this.code = code
  }
}
