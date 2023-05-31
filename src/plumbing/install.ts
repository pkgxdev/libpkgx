// deno-lint-ignore-file no-deprecated-deno-api
// ^^ dnt doesn’t support Deno.Command yet so we’re stuck with the deprecated Deno.run for now

import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts"
import { Package, Installation, StowageNativeBottle } from "../types.ts"
import useOffLicense from "../hooks/useOffLicense.ts"
import { writeAll } from "deno/streams/write_all.ts"
import useDownload from "../hooks/useDownload.ts"
import useConfig from "../hooks/useConfig.ts"
import useCellar from "../hooks/useCellar.ts"
import { flock } from "../utils/flock.deno.ts"
import useCache from "../hooks/useCache.ts"
import useFetch from "../hooks/useFetch.ts"
import Path from "../utils/Path.ts"

export default async function install(pkg: Package, logger?: Logger): Promise<Installation> {
  const { project, version } = pkg

  const cellar = useCellar()
  const { prefix: tea_prefix, options: { compression } } = useConfig()
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const tarball = useCache().path(stowage)
  const shelf = tea_prefix.join(pkg.project)

  logger?.locking(pkg)
  const { rid: fd } = await Deno.open(shelf.mkdir('p').string)
  await flock(fd, 'ex')

  try {
    const already_installed = await cellar.has(pkg)
    if (already_installed) {
      // some other tea instance installed us while we were waiting for the lock
      // or potentially we were already installed and the caller is naughty
      logger?.installed(already_installed)
      return already_installed
    }

    logger?.downloading({pkg})

    const tmpdir = Path.mktemp({
      dir: tea_prefix.join("local/tmp").join(pkg.project),
      prefix: `v${pkg.version}.`
      //NOTE ^^ inside tea prefix to avoid TMPDIR is on a different volume problems
    })
    const tar_args = compression == 'xz' ? 'xJ' : 'xz'  // laughably confusing
    const untar = Deno.run({
      cmd: ["tar", tar_args, "--strip-components", (pkg.project.split("/").length + 1).toString()],
      stdin: 'piped', stdout: "inherit", stderr: "inherit",
      cwd: tmpdir.string,
    })
    const hasher = createHash("sha256")
    const remote_SHA_promise = remote_SHA(new URL(`${url}.sha256sum`))

    let total: number | undefined
    let n = 0
    await useDownload().download({
      src: url,
      dst: tarball,
      logger: info => {
        logger?.downloading({ pkg, ...info })
        total ??= info.total
      }
    }, blob => {
      n += blob.length
      hasher.update(blob)
      logger?.installing({ pkg, progress: total ? n / total : total })
      return writeAll(untar.stdin, blob)
    })

    untar.stdin.close()

    const untar_exit_status = await untar.status()
    if (!untar_exit_status.success) {
      throw new Error(`tar exited with status ${untar_exit_status.code}`)
    } else {
      untar.close()  //TODO should we do this for the error case too or what?
    }

    const computed_hash_value = hasher.digest("hex")
    const checksum = await remote_SHA_promise

    if (computed_hash_value != checksum) {
      tarball.rm()
      console.error("tea: we deleted the invalid tarball. try again?")
      throw new Error(`sha: expected: ${checksum}, got: ${computed_hash_value}`)
    }

    const path = tmpdir.mv({ to: shelf.join(`v${pkg.version}`) })
    const install = { pkg, path }

    logger?.installed(install)

    return install
  } catch (err) {
    tarball.rm()  //FIXME resumable downloads!
    throw err
  } finally {
    logger?.unlocking(pkg)
    await flock(fd, 'un')
    Deno.close(fd)  // docs aren't clear if we need to do this or not
  }
}

async function remote_SHA(url: URL) {
  const rsp = await useFetch(url)
  if (!rsp.ok) throw rsp
  const txt = await rsp.text()
  return txt.split(' ')[0]
}


export interface Logger {
  locking(pkg: Package): void
  /// raw http info
  downloading(info: {pkg: Package, src?: URL, dst?: Path, rcvd?: number, total?: number}): void
  /// we are simultaneously downloading and untarring the bottle
  /// the install progress here is proper and tied to download progress
  /// progress is a either a fraction between 0 and 1 or the number of bytes that have been untarred
  /// we try to give you the fraction as soon as possible, but you will need to deal with both formats
  installing(info: {pkg: Package, progress: number | undefined}): void
  unlocking(pkg: Package): void
  installed(installation: Installation): void
}

// deno-lint-ignore no-explicit-any
export function ConsoleLogger(prefix?: any): Logger {
  prefix = prefix ? `${prefix}: ` : ""
  return {
    locking: function() { console.error(`${prefix}locking`, ...arguments) },
    downloading: function() { console.error(`${prefix}downloading`, ...arguments) },
    installing: function() { console.error(`${prefix}installing`, ...arguments) },
    unlocking: function() { console.error(`${prefix}unlocking`, ...arguments) },
    installed: function() { console.error(`${prefix}installed`, ...arguments) }
  }
}
