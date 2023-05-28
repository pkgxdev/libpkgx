import { Installation, Package, PackageRequirement } from "../types.ts"
import { assert, assertEquals, fail } from "deno/testing/asserts.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import resolve, { _internals } from "./resolve.ts"
import useCellar from "../hooks/useCellar.ts"
import { stub } from "deno/testing/mock.ts"
import SemVer from "../utils/semver.ts"
import Path from "../utils/Path.ts"

Deno.test("resolve cellar.has", async runner => {
  const prefix = useTestConfig().prefix
  const pkg = { project: "foo", version: new SemVer("1.0.0") }

  const cellar = useCellar()
  const has = (_: Path | Package | PackageRequirement) => {
    const a: Installation = {pkg, path: prefix.join(pkg.project, `v${pkg.version}`) }
    return Promise.resolve(a)
  }

  await runner.step("happy path", async () => {
    const stub1 = stub(_internals, "useInventory", () => ({
      get: () => fail(),
      select: () => Promise.resolve(pkg.version)
    }))
    const stub2 = stub(_internals, "useCellar", () => ({
      ...cellar, has
    }))

    try {
      const rv = await resolve([pkg])
      assertEquals(rv.pkgs[0].project, pkg.project)
      assertEquals(rv.installed[0].pkg.project, pkg.project)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })

  await runner.step("throws if no version", async () => {
    const stub1 = stub(_internals, "useInventory", () => ({
      get: () => fail(),
      select: () => Promise.resolve(undefined),
    }))
    const stub2 = stub(_internals, "useCellar", () => ({
      ...cellar,
      has: () => Promise.resolve(undefined)
    }))

    let errord = false
    try {
      await resolve([{ ...pkg, version: new SemVer("1.0.1") }])
    } catch {
      errord = true
    } finally {
      stub1.restore()
      stub2.restore()
    }
    assert(errord)
  })

  await runner.step("uses existing version if  even if update set", async () => {
    const stub1 = stub(_internals, "useInventory", () => ({
      get: () => fail(),
      select: () => Promise.resolve(pkg.version),
    }))
    const stub2 = stub(_internals, "useCellar", () => ({
      ...cellar, has
    }))

    try {
      const rv = await resolve([pkg], { update: true })
      assertEquals(rv.pkgs[0].project, pkg.project)
      assertEquals(rv.installed[0].pkg.project, pkg.project)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })
})
