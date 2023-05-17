import SemVer, { Range } from "./utils/semver.ts"
import Path from "./utils/Path.ts"
import host from "./utils/host.ts"

export interface Package {
  project: string
  version: SemVer
}

export interface PackageRequirement {
  project: string
  constraint: Range
}

export type PackageSpecification = Package | PackageRequirement

export interface Installation {
  path: Path
  pkg: Package
}

// when we support more variants of these that require specification
// we will tuple a version in with each eg. 'darwin' | ['windows', 10 | 11 | '*']
export const SupportedPlatforms = ["darwin" , "linux" , "windows"] as const
export type SupportedPlatform = typeof SupportedPlatforms[number]

export const SupportedArchitectures = ["x86-64", "aarch64"] as const
export type SupportedArchitecture = typeof SupportedArchitectures[number]

/// remotely available package content (bottles or source tarball)
export type Stowage = {
  type: 'src'
  pkg: Package
  extname: string
} | {
  type: 'bottle'
  pkg: Package
  compression: 'xz' | 'gz'
  host?: { platform: SupportedPlatform, arch: SupportedArchitecture }
}

/// once downloaded, `Stowage` becomes `Stowed`
export type Stowed = Stowage & { path: Path }

export function StowageNativeBottle(opts: { pkg: Package, compression: 'xz' | 'gz' }): Stowage {
  return { ...opts, host: host(), type: 'bottle' }
}
