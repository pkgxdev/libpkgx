import { Installation, PackageSpecification } from "../types.ts"
import install, { Logger } from "../plumbing/install.ts"
import usePantry from "../hooks/usePantry.ts"
import hydrate from "../plumbing/hydrate.ts"
import resolve from "../plumbing/resolve.ts"
import { isArray, isString } from "is-what"
import { parse } from "../utils/pkg.ts"
import link from "../plumbing/link.ts"
import useSync from "../hooks/useSync.ts";

/// eg. install("python.org~3.10")
export default async function(pkgs: PackageSpecification[] | string[] | string, logger?: Logger): Promise<Installation[]> {

  if (!isArray(pkgs)) pkgs = [pkgs]
  pkgs = pkgs.map(pkg => isString(pkg) ? parse(pkg) : pkg)

  const pantry = usePantry()

  if (pantry.missing() || pantry.neglected()) {
    useSync()
  }

  //TODO parallelize!

  pkgs = (await hydrate(pkgs)).pkgs
  const { pending, installed } = await resolve(pkgs)
  for (const pkg of pending) {
    const installation = await install(pkg, logger)
    await link(installation)
    installed.push(installation)
  }

  return installed
}
