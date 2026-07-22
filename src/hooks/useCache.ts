import type { Stowage } from "../types.ts"
import useConfig from "./useConfig.ts"
import host from "../utils/host.ts"
import type Path from "../utils/Path.ts"

export default function useCache(): { path: (stowage: Stowage) => Path } {
  return { path }
}

const path = (stowage: Stowage): Path => {
  const { pkg, type } = stowage
  const stem = pkg.project.replaceAll("/", "∕")

  let filename = `${stem}-${pkg.version}`
  if (type == 'bottle') {
    const { platform, arch } = stowage.host ?? host()
    filename += `+${platform}+${arch}.tar.${stowage.compression}`
  } else {
    filename += stowage.extname
  }

  return useConfig().cache.join(filename)
}
