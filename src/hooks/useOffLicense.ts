import { Stowage } from "../types.ts"
import host from "../utils/host.ts"
import useConfig from "./useConfig.ts";

type Type = 's3'

export default function useOffLicense(_type: Type) {
  return { url, key }
}

function key(stowage: Stowage) {
  const rv = [stowage.pkg.project]
  if (stowage.type == 'bottle') {
    const { platform, arch } = stowage.host ?? host()
    rv.push(`${platform}/${arch}`)
  }
  let fn = `v${stowage.pkg.version}`
  if (stowage.type == 'bottle') {
    fn += `.tar.${stowage.compression}`
  } else {
    fn +=  stowage.extname
  }
  rv.push(fn)
  return rv.join("/")
}

function url(stowage: Stowage) {
  return new URL(`${useConfig().dist}/${key(stowage)}`)
}
