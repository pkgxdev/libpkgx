import { Package, PackageRequirement, Installation } from "../types.ts"
import useInventory from "../hooks/useInventory.ts"
import { str as pkgstr } from "../utils/pkg.ts"
import useCellar from "../hooks/useCellar.ts"
import { PkgxError } from "../utils/error.ts"

/// NOTE resolves to bottles
/// NOTE contract there are no duplicate projects in input

export interface Resolution {
  /// fully resolved list (includes both installed and pending)
  pkgs: Package[]

  /// already installed packages
  installed: Installation[]

  /// these are the pkgs that aren’t yet installed
  pending: Package[]
}

export class ResolveError extends PkgxError {
  pkg: Package | PackageRequirement

  constructor(pkg: Package | PackageRequirement) {
    super(`not-found: pkg: ${pkgstr(pkg)}`)
    this.pkg = pkg
  }
}

/// resolves a list of package specifications based on what is available in
/// bottle storage if `update` is false we will return already installed pkgs
/// that resolve so if we are resolving `node>=12`, node 13 is installed, but
/// node 19 is the latest we return node 13. if `update` is true we return node
/// 19 and *you will need to install it*.
export default async function resolve(reqs: (Package | PackageRequirement)[], {update}: {update: boolean | Set<string>} = {update: false}): Promise<Resolution> {
  const inventory = _internals.useInventory()
  const cellar = _internals.useCellar()
  const rv: Resolution = { pkgs: [], installed: [], pending: [] }
  let installation: Installation | undefined

  const promises: Promise<void>[] = []

  for (const req of reqs) {
    const noup = !should_update(req.project)
    if (noup && (installation = await cellar.has(req))) {
      // if something is already installed that satisfies the constraint then use it
      rv.installed.push(installation)
      rv.pkgs.push(installation.pkg)
    } else {
      const promise = inventory.select(req).then(async version => {
        if (!version) {
          throw new ResolveError(req)
        }
        const pkg = { version, project: req.project }
        rv.pkgs.push(pkg)

        if ((installation = await cellar.has(pkg))) {
          // we were asked to update, but we already are at the latest version
          rv.installed.push(installation)
        } else {
          rv.pending.push(pkg)
        }
      })
      promises.push(promise)
    }
  }

  await Promise.all(promises)

  return rv

  function should_update(project: string) {
    return update === true || (update instanceof Set && update.has(project))
  }
}

export const _internals = {
  useInventory,
  useCellar
}
