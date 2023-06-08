// deno-lint-ignore-file no-deprecated-deno-api
// ^^ Deno.Command is not implemented for dnt shims yet
import { deno } from "../deps.ts"
const { streams: { writeAll } } = deno
import { flock } from "../utils/flock.deno.ts"
import useDownload from "./useDownload.ts"
import usePantry from "./usePantry.ts"
import useConfig from "./useConfig.ts"
import Path from "../utils/Path.ts"

//FIXME tar is fetched from PATH :/ we want control
//FIXME run in general is not controllable since it delegates to the shell

interface Logger {
  syncing(path: Path): void
  syncd(path: Path): void
}

export default async function(logger?: Logger) {
  const pantry_dir = usePantry().prefix.parent()

  logger?.syncing(pantry_dir)

  const { rid } = await Deno.open(pantry_dir.mkdir('p').string)
  await flock(rid, 'ex')

  try {
    //TODO if there was already a lock, just wait on it, don’t do the following stuff

    const git_dir = pantry_dir.parent().join("pantries/teaxyz/pantry")

    if (git_dir.join("HEAD").isFile()) {
      await git("-C", git_dir, "fetch", "--quiet", "origin", "--force", "main:main")
    } else {
      await git("clone", "--quiet", "--bare", "--depth=1", "https://github.com/teaxyz/pantry", git_dir)
    }

    await git("--git-dir", git_dir, "--work-tree", pantry_dir, "checkout", "--quiet", "--force")

  } catch {
    // git failure or no git installed
    // ∴ download the latest tarball and uncompress over the top
    //FIXME deleted packages will not be removed with this method
    const src = new URL(`https://github.com/teaxyz/pantry/archive/refs/heads/main.tar.gz`)
    const proc = Deno.run({
      cmd: ["tar", "xz", "--strip-components=1"],
      cwd: pantry_dir.string,
      stdin: "piped"
    })
    await useDownload().download({ src }, blob => writeAll(proc.stdin, blob))
    proc.stdin.close()

    if (!(await proc.status()).success) {
      throw new Error("untar failed")
    }

    proc.close()

  } finally {
    await flock(rid, 'un')
    Deno.close(rid)  // docs aren't clear if we need to do this or not
  }

  logger?.syncd(pantry_dir)
}

//////////////////////// utils

async function git(...args: (string | Path)[]) {
  const { git } = useConfig()
  if (!git) throw new Error("no-git")  // caught above to trigger http download instead
  await run({cmd: [git, ...args]})
}

export interface RunOptions {
  cmd: (string | Path)[]
}

async function run(opts: RunOptions) {
  const cmd = opts.cmd.map(x => `${x}`)
  const proc = Deno.run({ ...opts, cmd, stdout: 'null', clearEnv: true })
  try {
    const exit = await proc.status()
    if (!exit.success) throw new Error(`run.exit(${exit.code})`)
  } catch (err) {
    err.cause = proc
    throw err
  } finally {
    proc.close()
  }
}
