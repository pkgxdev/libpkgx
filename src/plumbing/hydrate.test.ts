import { assert, assertEquals, assertRejects } from "@std/assert"
import { describe, it } from "@std/testing/bdd"
import { PackageRequirement } from "../types.ts"
import * as semver from "../utils/semver.ts"
import hydrate from "./hydrate.ts"

describe("hydrate()", () => {
  it("hydrates.1", async function() {
    const pkgs = [
      { project: 'nodejs.org', constraint: new semver.Range('*') },
      { project: 'nodejs.org', constraint: new semver.Range('>=18.14') }
    ]

    const rv1 = semver.intersect(pkgs[0].constraint, pkgs[1].constraint)
    assertEquals(rv1.toString(), '>=18.14')

    const rv =  await hydrate(pkgs, (_a: PackageRequirement, _b: boolean) => Promise.resolve([]))

    let nodes = 0
    for (const pkg of rv.pkgs) {
      if (pkg.project === 'nodejs.org') {
        nodes++
        assertEquals(pkg.constraint.toString(), '>=18.14')
      }
    }

    assertEquals(nodes, 1)
  })

  it("hydrates.2", async function() {
    const pkgs = [
      { project: 'pipenv.pypa.io', constraint: new semver.Range('*') },
      { project: 'python.org', constraint: new semver.Range('~3.9') }
    ]

    const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'pipenv.pypa.io') {
        return Promise.resolve([
          { project: 'python.org', constraint: new semver.Range('>=3.7') }
        ])
      } else {
        return Promise.resolve([])
      }
    })

    let nodes = 0
    for (const pkg of rv.pkgs) {
      if (pkg.project === 'python.org') {
        assertEquals(pkg.constraint.toString(), '~3.9')
        nodes++
      }
    }

    assertEquals(nodes, 1)
  })

  it("hydrates.3", async function() {
    const pkgs = [
      { project: 'pipenv.pypa.io', constraint: new semver.Range('*') },
      { project: 'python.org', constraint: new semver.Range('~3.9') }
    ]

    const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'pipenv.pypa.io') {
        return Promise.resolve([
          { project: 'python.org', constraint: new semver.Range('~3.9.1') }
        ])
      } else {
        return Promise.resolve([])
      }
    })

    let nodes = 0
    for (const pkg of rv.pkgs) {
      if (pkg.project === 'python.org') {
        assertEquals(pkg.constraint.toString(), '~3.9.1')
        nodes++
      }
    }

    assertEquals(nodes, 1)
  })

  it("hydrates.unicode.org", async function() {
    const pkgs = [
      { project: 'npmjs.com', constraint: new semver.Range('*') },
      { project: 'python.org', constraint: new semver.Range('~3.9') }
    ]

    const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'python.org') {
        return Promise.resolve([
          { project: 'unicode.org', constraint: new semver.Range('^73') }
        ])
      } else {
        return Promise.resolve([
          { project: 'unicode.org', constraint: new semver.Range('^71') }
        ])
      }
    })

    const unicodes = rv.pkgs.filter(x => x.project === 'unicode.org')
    const constraints = new Set(unicodes.map(x => x.constraint.toString()))
    assertEquals(constraints.size, 2)
    assert(constraints.has("^71"))
    assert(constraints.has("^73"))
  })

  it("hydrates.cannot-intersect", async function() {
    const pkgs = [
      { project: 'npmjs.com', constraint: new semver.Range('*') },
      { project: 'python.org', constraint: new semver.Range('~3.9') }
    ]

    const rv = hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'python.org') {
        return Promise.resolve([
          { project: 'nodejs.com', constraint: new semver.Range('^73') }
        ])
      } else {
        return Promise.resolve([
          { project: 'nodejs.com', constraint: new semver.Range('^71') }
        ])
      }
    })

    await assertRejects(() => rv)
  })
})
