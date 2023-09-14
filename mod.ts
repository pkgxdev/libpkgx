import "./src/utils/misc.ts"
import { flatmap, validate } from "./src/utils/misc.ts"

import host, { SupportedArchitecture, SupportedPlatform } from "./src/utils/host.ts"
import SemVer, * as semver from "./src/utils/semver.ts"
import Path from "./src/utils/Path.ts"

export * as types from "./src/types.ts"
import * as pkg from "./src/utils/pkg.ts"

import { panic, TeaError } from "./src/utils/error.ts"
import useConfig from "./src/hooks/useConfig.ts"
import useOffLicense from "./src/hooks/useOffLicense.ts"
import useCache from "./src/hooks/useCache.ts"
import useCellar, { InstallationNotFoundError } from "./src/hooks/useCellar.ts"
import useMoustaches from "./src/hooks/useMoustaches.ts"
import usePantry, {
  PackageNotFoundError,
  PantryError,
  PantryNotFoundError,
  PantryParseError,
} from "./src/hooks/usePantry.ts"
import useFetch from "./src/hooks/useFetch.ts"
import useDownload, { DownloadError } from "./src/hooks/useDownload.ts"
import useShellEnv from "./src/hooks/useShellEnv.ts"
import useInventory from "./src/hooks/useInventory.ts"
import hydrate from "./src/plumbing/hydrate.ts"
import which from "./src/plumbing/which.ts"
import link from "./src/plumbing/link.ts"
import install, { ConsoleLogger } from "./src/plumbing/install.ts"
import resolve, { ResolveError } from "./src/plumbing/resolve.ts"
import { validatePackageRequirement } from "./src/utils/hacks.ts"
import useSync from "./src/hooks/useSync.ts"
import run, { RunError } from "./src/porcelain/run.ts"
import porcelain_install from "./src/porcelain/install.ts"

const utils = {
  pkg,
  host,
  flatmap,
  validate,
  panic,
  ConsoleLogger,
}

const hooks = {
  useCache,
  useCellar,
  useConfig,
  useDownload,
  useFetch,
  useInventory,
  useMoustaches,
  useOffLicense,
  usePantry,
  useShellEnv,
  useSync,
}

const plumbing = {
  hydrate,
  link,
  install,
  resolve,
  which,
}

const porcelain = {
  install: porcelain_install,
  run,
}

const hacks = {
  validatePackageRequirement,
}

export {
  DownloadError,
  hacks,
  hooks,
  InstallationNotFoundError,
  PackageNotFoundError,
  PantryError,
  PantryNotFoundError,
  PantryParseError,
  plumbing,
  porcelain,
  ResolveError,
  RunError,
  semver,
  TeaError,
  utils,
}

/// export types
// we cannot add these to the above objects or they cannot be used as types
export { Path, SemVer }
export * from "./src/types.ts"
export type { SupportedArchitecture, SupportedPlatform }
