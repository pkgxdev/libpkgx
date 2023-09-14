import host, { SupportedArchitecture, SupportedPlatform } from "./utils/host.ts"
import SemVer, { Range } from "./utils/semver.ts"
import Path from "./utils/Path.ts"

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

/// remotely available package content (bottles or source tarball)
export type Stowage = {
  type: "src"
  pkg: Package
  extname: string
} | {
  type: "bottle"
  pkg: Package
  compression: "xz" | "gz"
  host?: { platform: SupportedPlatform; arch: SupportedArchitecture }
}

/// once downloaded, `Stowage` becomes `Stowed`
export type Stowed = Stowage & { path: Path }

export function StowageNativeBottle(opts: { pkg: Package; compression: "xz" | "gz" }): Stowage {
  return { ...opts, host: host(), type: "bottle" }
}
