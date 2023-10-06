import { Package, PackageRequirement } from "../types.ts"
import { DownloadError } from "./useDownload.ts"
import SemVer from "../utils/semver.ts"
import useFetch from "./useFetch.ts"
import host from "../utils/host.ts"
import "../utils/misc.ts"

export interface Inventory {
  [project: string]: {
    [platform: string]: {
      [arch: string]: string[]
    }
  }
}

const select = async (rq: PackageRequirement | Package) => {
  const versions = await _internals.get(rq)

  if ("constraint" in rq) {
    return rq.constraint.max(versions)
  } else if (versions.find(x => x.eq(rq.version))) {
    return rq.version
  }
}

const get = async (rq: PackageRequirement | Package) => {
  const { platform, arch } = host()
  const url = new URL(`https://dist.pkgx.dev/${rq.project}/${platform}/${arch}/versions.txt`)
  const rsp = await useFetch(url)

  if (!rsp.ok) {
    throw new DownloadError(rsp.status, {src: url})
  }

  const releases = await rsp.text()
  let versions = releases.split("\n").compact(x => new SemVer(x))

  if (versions.length < 1) throw new Error()

  if (rq.project == 'openssl.org') {
    // workaround our previous sins
    const v = new SemVer("1.1.118")
    versions = versions.filter(x => x.neq(v))
  }

  return versions
}

export default function useInventory() {
  return { select, get }
}

export const _internals = { get }
