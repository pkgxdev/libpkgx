import { SupportedPlatform, SupportedArchitecture } from "../types.ts"
import process from "node:process"

interface HostReturnValue {
  platform: SupportedPlatform
  arch: SupportedArchitecture
  target: string
  build_ids: [SupportedPlatform, SupportedArchitecture]
}

export default function host(): HostReturnValue {
  const platform = (() => {
    const platform = _internals.platform()
    switch (platform) {
    case "darwin":
    case "linux":
    case "windows":
      return platform
    default:
      console.warn(`operating incognito as linux (${platform})`)
      return 'linux'
  }})()

  const arch = (() => {
    const arch = _internals.arch()
    switch (arch) {
    case "arm64":
      return "aarch64"
    case "x64":
      return "x86-64"
    default:
      throw new Error(`unsupported-arch: ${arch}`)
  }})()

  const { target } = Deno.build

  return {
    platform,
    arch,
    target,
    build_ids: [platform, arch]
  }
}

const _internals = {
  arch: () => process.arch,
  platform: () => Deno.build.os
}

export { _internals }
