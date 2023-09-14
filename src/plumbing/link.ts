import SemVer, * as semver from "../utils/semver.ts"
import { Installation, Package } from "../types.ts"
import useCellar from "../hooks/useCellar.ts"
import { panic } from "../utils/error.ts"
import fs from "node:fs/promises"
import Path from "../utils/Path.ts"

export default async function link(pkg: Package | Installation) {
  const installation = await useCellar().resolve(pkg)
  pkg = installation.pkg

  const versions = (await useCellar()
    .ls(installation.pkg.project))
    .map(({ pkg: { version }, path }) => [version, path] as [SemVer, Path])
    .sort(([a], [b]) => a.compare(b))

  if (versions.length <= 0) {
    const err = new Error("no versions")
    err.cause = pkg
    throw err
  }

  const shelf = installation.path.parent()
  const newest = versions.slice(-1)[0]
  const vMm = `${pkg.version.major}.${pkg.version.minor}`
  const minorRange = new semver.Range(`^${vMm}`)
  const mostMinor = versions.filter((v) => minorRange.satisfies(v[0])).at(-1) ?? panic()

  if (mostMinor[0].neq(pkg.version)) return
  // ^^ if we’re not the most minor we definitely not the most major

  await makeSymlink(`v${vMm}`)

  const majorRange = new semver.Range(`^${pkg.version.major.toString()}`)
  const mostMajor = versions.filter((v) => majorRange.satisfies(v[0])).at(-1) ?? panic()

  if (mostMajor[0].neq(pkg.version)) return
  // ^^ if we’re not the most major we definitely aren’t the newest

  await makeSymlink(`v${pkg.version.major}`)

  if (pkg.version.eq(newest[0])) {
    await makeSymlink("v*")
  }

  async function makeSymlink(symname: string) {
    try {
      const what_we_make = shelf.join(symname)
      if (what_we_make.isSymlink()) {
        try {
          // using this rather than rm due to bug in deno shims that
          // tries to call rmdir on the symlink because the symlink points to a dir
          await fs.unlink(what_we_make.string)
        } catch (err) {
          // we were deleted by another thing linking simultaneously
          //FIXME our flock should surround the link step too
          if (err.code != "ENOENT") throw err
        }
      }

      await Deno.symlink(
        installation.path.basename(), // makes it relative
        shelf.join(symname).rm().string,
        { type: "dir" },
      )
    } catch (err) {
      if (err instanceof Deno.errors.AlreadyExists || err.code === "EEXIST") {
        //FIXME race condition for installing the same pkg simultaneously
        // real fix is to lock around the entire download/untar/link process
        return
      } else {
        throw err
      }
    }
  }
}
