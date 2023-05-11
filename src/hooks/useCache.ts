import { Package, Stowage } from "../types.ts"
import useConfig from "./useConfig.ts"
import host from "../utils/host.ts"

export default function useCache() {
  return { path }
}

type DownloadOptions = {
  type: 'bottle'
  pkg: Package
} | {
  type: 'src',
  url: URL
  pkg: Package
}

const path = (stowage: Stowage) => {
  const { pkg, type } = stowage
  const stem = pkg.project.replaceAll("/", "∕")

  let filename = `${stem}-${pkg.version}`
  if (type == 'bottle') {
    const { platform, arch } = stowage.host ?? host()
    filename += `+${platform}+${arch}.tar.${stowage.compression}`
  } else {
    filename += stowage.extname
  }

  return useConfig().prefix.join("tea.xyz/var/www", filename)
}
