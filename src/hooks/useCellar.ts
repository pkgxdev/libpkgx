import { Package, PackageRequirement, Installation } from "../types.ts"
import * as pkgutils from "../utils/pkg.ts"
import SemVer from "../utils/semver.ts"
import useConfig from "./useConfig.ts"
import Path from "../utils/Path.ts"

export default function useCellar() {
  const config = useConfig()

  /// eg. ~/.tea/deno.land
  const shelf = (project: string) => config.prefix.join(project)

  /// eg. ~/.tea/deno.land/v1.2.3
  const keg = (pkg: Package) => shelf(pkg.project).join(`v${pkg.version}`)

  /// returns the `Installation` if the pkg is installed
  const has = (pkg: Package | PackageRequirement | Path) => resolve(pkg).swallow(/^not-found:/)

  return {
    has,
    ls,
    keg,
    resolve,
    shelf,
  }

  /// returns a project’s installations (sorted by version)
  async function ls(project: string) {
    const d = shelf(project)

    if (!d.isDirectory()) return []

    const rv: Installation[] = []
    for await (const [path, {name, isDirectory}] of d.ls()) {
      try {
        if (!isDirectory) continue
        if (!name.startsWith("v") || name == 'var') continue
        const version = new SemVer(name)
        if (await vacant(path)) continue  // failed build probs
        rv.push({path, pkg: {project, version}})
      } catch {
        console.debug(`invalid version: ${name}`)
      }
    }

    return rv.sort((a, b) => pkgutils.compare(a.pkg, b.pkg))
  }

  /// if package is installed, returns its installation
  async function resolve(pkg: Package | PackageRequirement | Path | Installation) {
    const installation = await (async () => {
      if ("pkg" in pkg) { return pkg }
      // ^^ is `Installation`

      const { prefix } = config
      if (pkg instanceof Path) {
        const path = pkg
        const version = new SemVer(path.basename())
        const project = path.parent().relative({ to: prefix })
        return {
          path, pkg: { project, version }
        }
      } else if ("version" in pkg) {
        const path = keg(pkg)
        return { path, pkg }
      } else {
        const installations = await ls(pkg.project)
        const versions = installations.map(({ pkg: {version}}) => version)
        const version = pkg.constraint.max(versions)
        console.debug({ installations, versions, version })
        if (version) {
          const path = installations.find(({pkg: {version: v}}) => v.eq(version))!.path
          return { path, pkg: { project: pkg.project, version } }
        }
      }
      throw new Error(`not-found:${pkgutils.str(pkg)}`)
    })()
    if (await vacant(installation.path)) {
      throw new Error(`not-found:${pkgutils.str(installation.pkg)}`)
    }
    return installation
  }
}

/// if we ignore transient files, is there a package here?
async function vacant(path: Path): Promise<boolean> {
  if (!path.isDirectory()) {
    return true
  } else for await (const _ of path.ls()) {
    return false
  }
  return true
}
