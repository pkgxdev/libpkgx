import { SupportedPlatform, SupportedArchitecture } from "../types.ts"

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
      console.warn("assuming linux mode for:", Deno.build.os)
      return 'linux'
  }})()

  const arch = (() => {
    switch (_internals.arch()) {
    case "aarch64":
      return "aarch64"
    case "x86_64":
      return "x86-64"
      // ^^ ∵ https://en.wikipedia.org/wiki/X86-64 and semver.org prohibits underscores
    default:
      throw new Error(`unsupported-arch: ${Deno.build.arch}`)
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
  arch: () => Deno.build.arch,
  platform: () => Deno.build.os
}

export { _internals }
