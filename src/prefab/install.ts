// deno-lint-ignore-file no-deprecated-deno-api
// dnt doesn’t support Deno.Command yet so we’re stuck with the deprecated Deno.run for now

import useLogger, { Logger, red, teal, gray, logJSON } from "../hooks/useLogger.ts"
import { Package, Installation, StowageNativeBottle } from "../types.ts"
import useOffLicense from "../hooks/useOffLicense.ts"
import useDownload from "../hooks/useDownload.ts"
import useConfig from "../hooks/useConfig.ts"
import useCellar from "../hooks/useCellar.ts"
import { flock } from "../utils/flock.deno.ts"
import useCache from "../hooks/useCache.ts"
import useFetch from "../hooks/useFetch.ts"
import * as pkgutils from "../utils/pkg.ts"
import Path from "../utils/Path.ts"
import * as fs from "node:fs"

import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts"


export default async function install(pkg: Package, logger?: Logger): Promise<Installation> {
  const { project, version } = pkg
  logger ??= useLogger().new(pkgutils.str(pkg))

  const cellar = useCellar()
  const { modifiers, prefix: tea_prefix } = useConfig()
  const { compression } = useConfig().options
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const tarball = useCache().path(stowage)
  const shelf = tea_prefix.join(pkg.project)

  const pkg_prefix_str = (pkg: Package) => [
      gray(useConfig().prefix.prettyString()),
      pkg.project,
      `${gray('v')}${pkg.version}`
    ].join(gray('/'))

  const log_install_msg = (install: Installation, title = 'installed') => {
    if (modifiers.json) {
      logJSON({status: title, pkg: pkgutils.str(install.pkg)})
    } else {
      const str = pkg_prefix_str(install.pkg)
      logger!.replace(`${title}: ${str}`, { prefix: false })
    }
  }

  if (modifiers.dryrun) {
    const install = { pkg, path: tea_prefix.join(pkg.project, `v${pkg.version}`) }
    log_install_msg(install, 'imagined')
    return install
  }

  if (!modifiers.json) {
    logger.replace(teal("locking"))
  } else {
    logJSON({status: "locking", pkg: pkgutils.str(pkg) })
  }
  const { rid } = await Deno.open(shelf.mkpath().string)
  flock(rid, 'ex')

  try {
    const already_installed = await cellar.has(pkg)
    if (already_installed) {
      // some other tea instance installed us while we were waiting for the lock
      // or potentially we were already installed and the caller is naughty
      if (!modifiers.json) {
        logger.replace(teal("installed"))
      } else {
        logJSON({status: "installed", pkg: pkgutils.str(pkg) })
      }
      return already_installed
    }

    if (!modifiers.json) {
      logger.replace(teal("querying"))
    } else {
      logJSON({status: "querying", pkg: pkgutils.str(pkg) })
    }

    let stream: AsyncIterableIterator<Uint8Array> | undefined = await useDownload().stream({ src: url, logger, dst: tarball })
    const is_downloading = stream !== undefined
    stream ??= fs.createReadStream(tarball.string)[Symbol.asyncIterator]()
    const tar_args = compression == 'xz' ? 'xJ' : 'xz'  // laughably confusing

    const datasaver = await (() => {
      if (!is_downloading) return
      tarball.parent().mkdir('p')
      return Deno.open(tarball.string, {create: true, write: true, truncate: true})
    })()

    const tmpdir = Path.mktemp({
      prefix: pkg.project.replaceAll("/", "_") + "_",
      dir: tea_prefix.join("local/tmp")
      //NOTE ^^ inside tea prefix to avoid TMPDIR is on a different volume problems
    })
    const untar = Deno.run({
      cmd: ["tar", tar_args, "--strip-components", (pkg.project.split("/").length + 1).toString()],
      stdin: 'piped', stdout: "inherit", stderr: "inherit",
      cwd: tmpdir.string,
    })
    const hasher = createHash("sha256")
    const remote_SHA_promise = remote_SHA(new URL(`${url}.sha256sum`))

    for await (const blob of stream) {
      const p1 = datasaver?.write(blob)
      const p2 = untar.stdin.write(blob)
      hasher.update(blob)
      await Promise.all([p1, p2])
    }

    untar.stdin.close()
    datasaver?.close()

    const untar_exit_status = await untar.status()
    if (!untar_exit_status.success) {
      throw new Error(`tar exited with status ${untar_exit_status.code}`)
    } else {
      untar.close()  //TODO should we do this for the error case too or what?
    }

    const computed_hash_value = hasher.digest("hex")
    const checksum = await remote_SHA_promise

    if (computed_hash_value != checksum) {
      if (!modifiers.json) logger.replace(red('error'))
      tarball.rm()
      console.error("we deleted the invalid tarball. try again?")
      throw new Error(`sha: expected: ${checksum}, got: ${computed_hash_value}`)
    }

    const path = tmpdir.mv({ to: shelf.join(`v${pkg.version}`) })
    const install = { pkg, path }

    log_install_msg(install)

    return install
  } catch (err) {
    tarball.rm()  //FIXME resumable downloads!
    throw err
  } finally {
    flock(rid, 'un')
    Deno.close(rid)  // docs aren't clear if we need to do this or not
  }
}

async function remote_SHA(url: URL) {
  const rsp = await useFetch(url)
  if (!rsp.ok) throw rsp
  const txt = await rsp.text()
  return txt.split(' ')[0]
}
