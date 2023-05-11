import { SupportedPlatform, SupportedArchitecture } from "../types.ts"

interface HostReturnValue {
  platform: SupportedPlatform
  arch: SupportedArchitecture
  target: string
  build_ids: [SupportedPlatform, SupportedArchitecture]
}

export default function host(): HostReturnValue {
  const arch = (() => {
    switch (Deno.build.arch) {
      case "aarch64": return "aarch64"
      case "x86_64": return "x86-64"
      // ^^ ∵ https://en.wikipedia.org/wiki/X86-64 and semver.org prohibits underscores
      default:
        throw new Error(`unsupported-arch: ${Deno.build.arch}`)
    }
  })()

  const { target } = Deno.build

  const platform = (() => {
    switch (Deno.build.os) {
      case "darwin":
      case "linux":
      case "windows":
        return Deno.build.os
      default:
        console.warn("assuming linux mode for:", Deno.build.os)
        return 'linux'
    }
  })()

  return {
    platform,
    arch,
    target,
    build_ids: [platform, arch]
  }
}
