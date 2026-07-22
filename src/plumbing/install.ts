import { type Package, type Installation, StowageNativeBottle } from "../types.ts"
import useOffLicense from "../hooks/useOffLicense.ts"
import useDownload, { DownloadError } from "../hooks/useDownload.ts"
import { flock } from "../utils/flock.ts"
import useConfig from "../hooks/useConfig.ts"
import useCellar from "../hooks/useCellar.ts"
import useCache from "../hooks/useCache.ts"
import useFetch from "../hooks/useFetch.ts"
import { createHash } from "node:crypto"
import Path from "../utils/Path.ts"
import SemVer from "../utils/semver.ts"

type Compression = 'xz' | 'gz'
const SYSTEM_PATH = Deno.build.os == 'windows' ? "C:\\windows\\system32" : "/usr/bin:/bin"
const XZ_BOOTSTRAP: Package = {
  project: "tukaani.org/xz",
  version: new SemVer("5.8.3")
}

export default async function install(pkg: Package, logger?: Logger): Promise<Installation> {
  const cellar = useCellar()
  const { prefix: PKGX_DIR, options: { compression } } = useConfig()
  const shelf = PKGX_DIR.join(pkg.project)
  const candidates: Compression[] = is_xz_bootstrap(pkg) && !has_xz(SYSTEM_PATH) ? ['gz'] : compressions(compression)

  logger?.locking?.(pkg)

  const unflock = await flock(shelf.mkdir('p'))

  try {
    const already_installed = await cellar.has(pkg)
    if (already_installed) {
      // some other pkgx instance installed us while we were waiting for the lock
      // or potentially we were already installed and the caller is naughty
      logger?.installed?.(already_installed)
      return already_installed
    }

    let last_err: unknown
    for (const candidate of candidates) {
      try {
        return await install_bottle(pkg, { compression: candidate, PKGX_DIR, logger })
      } catch (err) {
        if (!is_not_found(err)) throw err
        last_err = err
      }
    }
    throw last_err
  } finally {
    logger?.unlocking?.(pkg)
    await unflock()
  }
}

async function remote_SHA(url: URL) {
  const rsp = await useFetch(url)
  if (!rsp.ok) throw rsp
  const txt = await rsp.text()
  return txt.split(' ')[0]
}

async function install_bottle(pkg: Package, opts: {
  compression: Compression
  PKGX_DIR: Path
  logger?: Logger
}): Promise<Installation> {
  const { project, version } = pkg
  const { compression, PKGX_DIR, logger } = opts
  const stowage = StowageNativeBottle({ pkg: { project, version }, compression })
  const url = useOffLicense('s3').url(stowage)
  const tarball = useCache().path(stowage)
  const shelf = PKGX_DIR.join(pkg.project)

  logger?.downloading?.({pkg})

  const checksum = await remote_SHA(new URL(`${url}.sha256sum`))
  const env = await extractor_env({ compression, PKGX_DIR, logger })

  const tmpdir = Path.mktemp({
    //TODO dir should not be here ofc
    dir: PKGX_DIR.join(".local/tmp").join(pkg.project),
    prefix: `v${pkg.version}.`
    //NOTE ^^ inside pkgx prefix to avoid TMPDIR is on a different volume problems
  })
  const tar_args = compression == 'xz' ? 'xJf' : 'xzf'  // laughably confusing
  const untar = new Deno.Command("tar", {
    args: [tar_args, "-", "--strip-components", (pkg.project.split("/").length + 1).toString()],
    stdin: 'piped', stdout: "inherit", stderr: "inherit",
    cwd: tmpdir.string,
    /// hard coding path to ensure we don’t deadlock trying to use ourselves to untar ourselves
    env
  }).spawn()
  const hasher = createHash("sha256")
  const writer = untar.stdin.getWriter()

  try {
    let total: number | undefined
    let n = 0
    await useDownload().download({
      src: url,
      dst: tarball,
      logger: info => {
        logger?.downloading?.({ pkg, ...info })
        total ??= info.total
      }
    }, blob => {
      n += blob.length
      hasher.update(blob)
      logger?.installing?.({ pkg, progress: total ? n / total : total })
      return writer.write(blob)
    })

    await writer.close()

    const untar_exit_status = await untar.status
    if (!untar_exit_status.success) {
      throw new Error(`tar exited with status ${untar_exit_status.code}`)
    }

    const computed_hash_value = hasher.digest("hex")

    if (computed_hash_value != checksum) {
      tarball.rm()
      console.error("pkgx: we deleted the invalid tarball. try again?")
      throw new Error(`sha: expected: ${checksum}, got: ${computed_hash_value}`)
    }

    const path = tmpdir.mv({ to: shelf.join(`v${pkg.version}`) }).chmod(0o755)
    const install = { pkg, path }

    logger?.installed?.(install)

    return install
  } catch (err) {
    try { await writer.close() } catch { /* already closed */ }
    await untar.status
    tarball.rm()  //FIXME resumable downloads!
    tmpdir.rm({ recursive: true })
    throw err
  }
}

function compressions(preferred: Compression): Compression[] {
  switch (preferred) {
  case 'xz':
    return ['xz', 'gz']
  case 'gz':
    return ['gz', 'xz']
  }
}

function is_xz_bootstrap(pkg: Package): boolean {
  return pkg.project == XZ_BOOTSTRAP.project && pkg.version.eq(XZ_BOOTSTRAP.version)
}

async function extractor_env(opts: {
  compression: Compression
  PKGX_DIR: Path
  logger?: Logger
}): Promise<Record<string, string>> {
  const env: Record<string, string> = { PATH: SYSTEM_PATH }

  if (opts.compression != 'xz') return env
  if (has_xz(SYSTEM_PATH)) return env

  const xz = await install(XZ_BOOTSTRAP, opts.logger)
  env.PATH = `${xz.path.join("bin")}:${SYSTEM_PATH}`
  if (Deno.build.os == 'linux') {
    env.LD_LIBRARY_PATH = xz.path.join("lib").string
  }
  return env
}

function has_xz(PATH: string): boolean {
  const sep = Deno.build.os == 'windows' ? ';' : ':'
  const ext = Deno.build.os == 'windows' ? '.exe' : ''
  for (const part of PATH.split(sep)) {
    if (new Path(part).join(`xz${ext}`).isExecutableFile()) return true
  }
  return false
}

function is_not_found(err: unknown): boolean {
  return (
    err instanceof DownloadError && err.status == 404 ||
    err instanceof Response && err.status == 404
  )
}


export interface Logger {
  locking?(pkg: Package): void
  /// raw http info
  downloading?(info: {pkg: Package, src?: URL, dst?: Path, rcvd?: number, total?: number}): void
  /// we are simultaneously downloading and untarring the bottle
  /// the install progress here is proper and tied to download progress
  /// progress is a either a fraction between 0 and 1 or the number of bytes that have been untarred
  /// we try to give you the fraction as soon as possible, but you will need to deal with both formats
  installing?(info: {pkg: Package, progress: number | undefined}): void
  unlocking?(pkg: Package): void
  installed?(installation: Installation): void
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
