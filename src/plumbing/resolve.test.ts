// deno-lint-ignore-file require-await
import { assert, assertEquals, fail, assertRejects } from "deno/assert/mod.ts"
import { Installation, Package, PackageRequirement } from "../types.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import useInventory from "../hooks/useInventory.ts"
import resolve, { _internals } from "./resolve.ts"
import useCellar from "../hooks/useCellar.ts"
import * as semver from "../utils/semver.ts"
import { stub } from "deno/testing/mock.ts"
import SemVer from "../utils/semver.ts"
import Path from "../utils/Path.ts"

Deno.test("resolve cellar.has", {
  permissions: {'read': true, 'env': ["TMPDIR", "HOME"], 'write': [Deno.env.get("TMPDIR")!] }
}, async runner => {
  const prefix = useTestConfig().prefix
  const pkg = { project: "foo", version: new SemVer("1.0.0") }

  const cellar = useCellar()
  const has = async (pkg_: Package | PackageRequirement | Path) => {
    if (pkg_ instanceof Path) fail()
    if (pkg.project == pkg_.project) {
      if ('constraint' in pkg_ && !pkg_.constraint.satisfies(pkg.version)) return
      if ('version' in pkg_ && !pkg_.version.eq(pkg.version)) return
      const a: Installation = {pkg, path: prefix.join(pkg.project, `v${pkg.version}`) }
      return a
    }
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

  await runner.step("uses existing version if it is the latest even if update set", async () => {
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

  await runner.step("updates version if latest is not installed", async runner => {
    const stub1 = stub(_internals, "useInventory", () => ({
      get: () => fail(),
      select: () => Promise.resolve(new SemVer("1.0.1")),
    }))
    const stub2 = stub(_internals, "useCellar", () => ({
      ...cellar, has
    }))

    try {
      await runner.step("update: true", async () => {
        const rv = await resolve([{ project: pkg.project, constraint: new semver.Range("^1") }], { update: true })
        assertEquals(rv.pkgs[0].project, pkg.project)
        assertEquals(rv.pending[0].project, pkg.project)
        assertEquals(rv.pending[0].version, new SemVer("1.0.1"))
      })

      await runner.step("update: set", async () => {
        const update = new Set([pkg.project])
        const rv = await resolve([{ project: pkg.project, constraint: new semver.Range("^1") }], { update })
        assertEquals(rv.pkgs[0].project, pkg.project)
        assertEquals(rv.pending[0].project, pkg.project)
        assertEquals(rv.pending[0].version, new SemVer("1.0.1"))
      })
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })
})

const permissions = { net: false, read: true, env: ["TMPDIR", "HOME", "TMP", "TEMP"], write: true /*FIXME*/ }

// https://github.com/teaxyz/cli/issues/655
Deno.test("postgres@500 fails", { permissions }, async () => {
  useTestConfig()

  const pkg = {
    project: "posqtgres.org",
    version: new SemVer("15.0.1")
  }

  const select = useInventory().select
  const stub1 = stub(_internals, "useInventory", () => ({
    get: () => Promise.resolve([pkg.version]),
    select,
  }))

  const pkgs = [
    { project: pkg.project, constraint: new semver.Range('@500') }
  ]

  try {
    // https://github.com/teaxyz/cli/issues/655
    await assertRejects(() => resolve(pkgs))
  } finally {
    stub1.restore()
  }
})

// https://github.com/teaxyz/cli/issues/655
Deno.test("postgres@500 fails if installed", { permissions }, async () => {
  const pkg = {
    project: "posqtgres.org",
    version: new SemVer("15.0.1")
  }
  const prefix = useTestConfig().prefix

  const cellar = useCellar()
  const has = (b: Path | Package | PackageRequirement) => {
    if ("constraint" in b && b.constraint.satisfies(pkg.version)) {
      const a: Installation = {pkg, path: prefix.join(pkg.project, `v${pkg.version}`) }
      return Promise.resolve(a)
    } else {
      return Promise.resolve(undefined)
    }
  }

  const select = useInventory().select
  const stub1 = stub(_internals, "useInventory", () => ({
    get: () => Promise.resolve([pkg.version]),
    select,
  }))
  const stub2 = stub(_internals, "useCellar", () => ({
    ...cellar,
    has
  }))

  const pkgs = [
    { project: pkg.project, constraint: new semver.Range('@500') }
  ]

  try {
    // https://github.com/teaxyz/cli/issues/655
    await assertRejects(() => resolve(pkgs))
  } finally {
    stub1.restore()
    stub2.restore()
  }
})
