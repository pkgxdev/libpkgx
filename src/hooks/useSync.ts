// deno-lint-ignore-file no-deprecated-deno-api
// ^^ Deno.Command is not implemented for dnt shims yet
import { deno } from "../deps.ts"
const { streams: { writeAll } } = deno
import { flock } from "../utils/flock.deno.ts"
import useDownload from "./useDownload.ts"
import usePantry from "./usePantry.ts"
import useConfig from "./useConfig.ts"
import Path from "../utils/Path.ts"
import useSyncCache from "./useSyncCache.ts";

//FIXME tar is fetched from PATH :/ we want control
//FIXME run in general is not controllable since it delegates to the shell

interface Logger {
  syncing(path: Path): void
  caching(path: Path): void
  syncd(path: Path): void
}

export default async function(logger?: Logger) {
  const pantry_dir = usePantry().prefix.parent()

  logger?.syncing(pantry_dir)

  const unflock = await flock(pantry_dir.mkdir('p'))

  try {
    await _internals.sync(pantry_dir)
    try {
      logger?.caching(pantry_dir)
      await _internals.cache()
    } catch (err) {
      console.warn("failed to cache pantry")
      console.error(err)
    }
  } finally {
    await unflock()
  }

  logger?.syncd(pantry_dir)
}

export const _internals = {
  sync, cache: useSyncCache
}

async function sync(pantry_dir: Path) {
  try {
    //TODO if there was already a lock, just wait on it, don’t do the following stuff

    const git_dir = pantry_dir.parent().join("pantries/pkgxdev/pantry")

    if (git_dir.join("HEAD").isFile()) {
      await git("-C", git_dir, "fetch", "--quiet", "origin", "--force", "main:main")
    } else {
      await git("clone", "--quiet", "--bare", "--depth=1", "https://github.com/pkgxdev/pantry", git_dir)
    }

    await git("--git-dir", git_dir, "--work-tree", pantry_dir, "checkout", "--quiet", "--force")

  } catch {
    // git failure or no git installed
    // ∴ download the latest tarball and uncompress over the top
    //FIXME deleted packages will not be removed with this method
    const src = new URL(`https://github.com/pkgxdev/pantry/archive/refs/heads/main.tar.gz`)
    const proc = Deno.run({
      cmd: ["tar", "xzf", "-", "--strip-components=1"],
      cwd: pantry_dir.string,
      stdin: "piped"
    })
    await useDownload().download({ src }, blob => writeAll(proc.stdin, blob))
    proc.stdin.close()

    if (!(await proc.status()).success) {
      throw new Error("untar failed")
    }

    proc.close()

  }
  // Write a file indicating last sync time
  const now = new Date().toISOString()
  const last_sync_file = pantry_dir.join("projects").join(".last_sync")
  await Deno.writeTextFile(last_sync_file.string, now)
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
  const env = (({ HTTP_PROXY, HTTPS_PROXY }) => ({ HTTP_PROXY, HTTPS_PROXY }))(Deno.env.toObject())
  const proc = Deno.run({ ...opts, cmd, stdout: 'null', clearEnv: true, env })
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
