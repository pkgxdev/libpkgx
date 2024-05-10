import { Package, PackageRequirement } from "../types.ts"
import { DownloadError } from "./useDownload.ts"
import SemVer from "../utils/semver.ts"
import useFetch from "./useFetch.ts"
import host from "../utils/host.ts"
import "../utils/misc.ts"
import useConfig from "./useConfig.ts";

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
  const url = new URL(`${useConfig().dist}/${rq.project}/${platform}/${arch}/versions.txt`)
  const rsp = await useFetch(url)

  if (!rsp.ok) {
    throw new DownloadError(rsp.status, {src: url})
  }

  const releases = await rsp.text()
  let versions = releases.trim().split("\n").map(x => new SemVer(x))

  if (versions.length < 1) throw new Error(`No versions for ${rq.project}`)

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
