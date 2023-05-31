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

/// the single string form handles spaces the same as node’s exec
// export default function(cmd: string | (string | Path)[], opts?: Options): RunPromise<void> {
//   let args: string[]
//   if (!isArray(cmd)) {
//     args = split(cmd)
//   } else {
//     args = cmd.map(x => x.toString())
//   }
//   if (args.length == 0) throw new RunError('EUSAGE', `\`cmd\` evaluated empty: ${cmd}`)
//   return new RunPromise(args.shift()!, args, opts)
// }

interface Options {
  env?: Record<string, string | undefined>
  logger?: Logger

  stdout?: boolean
  stderr?: boolean
  status?: boolean
}

type Cmd = string | (string | Path)[]

/// if you pass a single string we call that string via /bin/sh
/// if you don’t want that pass an array of args
export default async function run(cmd: Cmd): Promise<void>;
export default async function run(cmd: Cmd, opts: {stdout: true}): Promise<{ stdout: string }>;
export default async function run(cmd: Cmd, opts: {stderr: true}): Promise<{ stderr: string }>;
export default async function run(cmd: Cmd, opts: {status: true}): Promise<{ status: number }>;
export default async function run(cmd: Cmd, opts: {stdout: true, stderr: true}): Promise<{ stdout: string, stderr: string }>;
export default async function run(cmd: Cmd, opts: {stdout: true, status: true}): Promise<{ stdout: string, status: number }>;
export default async function run(cmd: Cmd, opts: {stderr: true, status: true}): Promise<{ stderr: string, status: number }>;
export default async function run(cmd: Cmd, opts: {stdout: true, stderr: true, status: true }): Promise<{ stdout: string, stderr: string, status: number }>;
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

interface Options {
  env?: Record<string, string | undefined>
  logger?: Logger
}

class RunPromise<T> implements PromiseLike<T> {
  private stdout: 'pipe' | 'inherit' = 'inherit'
  private stderr: 'pipe' | 'inherit' = 'inherit'
  private spawned = false
  private promise: Promise<{stdout: string, stderr: string, status: number}>

  capture(wut: 'stdout' | 'stderr'): RunPromise<{ stdout: string, status: number }> {
    if (this.spawned) {
      console.warn('tea: capture() called after proc spawned; capture will be empty')
    }
    if (wut == 'stdout') {
      this.stdout = 'pipe'
    } else {
      this.stderr = 'pipe'
    }
    return this as RunPromise<{ stdout: string, status: number }>
  }

  async status(): Promise<number> {
    try {
      const { status } = await this as { status: number }
      return status
    } catch (err) {
      if (err instanceof RunError && err.code == 'EIO') {
        return err.cause as number
      } else {
        throw err
      }
    }
  }

  constructor(cmd: string, args: string[], opts?: Options) {
    this.promise = new Promise((resolve, reject) => {
      setup(cmd, opts?.env ?? Deno.env.toObject(), opts?.logger).then(env => {
        const proc = spawn(cmd, args, { env, stdio: ["pipe", this.stdout, this.stderr] })

        this.spawned = true

        let stdout = '', stderr = ''
        proc.stdout?.on('data', data => stdout += data)
        proc.stderr?.on('data', data => stderr += data)
        proc.on('close', status => {
          if (status && (this.stdout == 'inherit' || this.stderr == 'inherit')) {
            const err = new RunError('EIO', `${cmd} exited with: ${status}`)
            err.cause = status
            reject(err)
          } else {
            const fulfill = resolve as ({}) => void
            fulfill({ stdout, stderr, status })
          }
        })
      }, reject)
    })
  }

  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    // deno-lint-ignore no-explicit-any
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2>
  {
    // deno-lint-ignore no-explicit-any
    return this.promise.then(onFulfilled as any, onRejected);
  }
}


type RunErrorCode = 'ENOENT' | 'EUSAGE' | 'EIO'

class RunError extends Error {
  code: RunErrorCode

  constructor(code: RunErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function split(str: string): string[] {
  const args = [];
  let currentArg = '';

  let insideQuotes = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      currentArg += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ' ' && !insideQuotes) {
      if (currentArg !== '') {
        args.push(currentArg);
        currentArg = '';
      }
      continue;
    }

    currentArg += char;
  }

  if (currentArg !== '') {
    args.push(currentArg);
  }

  return args;
}
