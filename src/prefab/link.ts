import SemVer, * as semver from "../utils/semver.ts"
import { Package, Installation } from "../types.ts"
import useCellar from "../hooks/useCellar.ts"
import useConfig from "../hooks/useConfig.ts"
import { panic } from "../utils/error.ts"
import Path from "../utils/Path.ts"

export default async function link(pkg: Package | Installation) {
  if (useConfig().modifiers.dryrun) return

  const installation = await useCellar().resolve(pkg)
  pkg = installation.pkg

  const versions = (await useCellar()
    .ls(installation.pkg.project))
    .map(({pkg: {version}, path}) => [version, path] as [SemVer, Path])
    .sort(([a],[b]) => a.compare(b))

  if (versions.length <= 0) {
    console.error(pkg, installation)
    throw new Error(`no versions`)
  }

  const shelf = installation.path.parent()
  const newest = versions.slice(-1)[0]
  const vMm = `${pkg.version.major}.${pkg.version.minor}`
  const minorRange = new semver.Range(`^${vMm}`)
  const mostMinor = versions.filter(v => minorRange.satisfies(v[0])).at(-1) ?? panic()

  if (mostMinor[0].neq(pkg.version)) return
  // ^^ if we’re not the most minor we definitely not the most major

  await makeSymlink(`v${vMm}`)

  const majorRange = new semver.Range(`^${pkg.version.major.toString()}`)
  const mostMajor = versions.filter(v => majorRange.satisfies(v[0])).at(-1) ?? panic()

  if (mostMajor[0].neq(pkg.version)) return
  // ^^ if we’re not the most major we definitely aren’t the newest

  await makeSymlink(`v${pkg.version.major}`)

  if (pkg.version.eq(newest[0])) {
    await makeSymlink('v*')
  }

  async function makeSymlink(symname: string) {
    const linkfile = shelf.join(symname)
    console.log({ "symlinking:": linkfile })
    await Deno.symlink(installation.path.basename(), linkfile.rm().string, {type: 'dir'})
  }
}
