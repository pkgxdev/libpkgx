import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert"
// pin: import-map bare `@std/testing/bdd` does not resolve under current Deno
import { describe, it } from "jsr:@std/testing@1.0.3/bdd"
import { PackageRequirement } from "../types.ts"
import * as semver from "../utils/semver.ts"
import hydrate, { MULTI_VERSION_PROJECTS } from "./hydrate.ts"

function constraintSet(pkgs: PackageRequirement[], project: string) {
  return new Set(
    pkgs.filter(p => p.project === project).map(p => p.constraint.toString())
  )
}

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

    const constraints = constraintSet(rv.pkgs, 'unicode.org')
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

  it("hydrates.multi-version.allowlist", function() {
    assert(MULTI_VERSION_PROJECTS.has('unicode.org'))
    assert(MULTI_VERSION_PROJECTS.has('openssl.org'))
    assert(MULTI_VERSION_PROJECTS.has('abseil.io'))
    assert(!MULTI_VERSION_PROJECTS.has('nodejs.org'))
  })

  it("hydrates.openssl.org", async function() {
    // python locks ^1.1; cryptography needs ^3 — must coexist
    const pkgs = [
      { project: 'python.org', constraint: new semver.Range('*') },
      { project: 'cryptography.io', constraint: new semver.Range('*') }
    ]

    const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'python.org') {
        return Promise.resolve([
          { project: 'openssl.org', constraint: new semver.Range('^1.1') }
        ])
      } else if (pkg.project === 'cryptography.io') {
        return Promise.resolve([
          { project: 'openssl.org', constraint: new semver.Range('^3') }
        ])
      } else {
        return Promise.resolve([])
      }
    })

    const constraints = constraintSet(rv.pkgs, 'openssl.org')
    assertEquals(constraints.size, 2)
    assert(constraints.has("^1.1"))
    assert(constraints.has("^3"))
    // the two lines remain disjoint
    assertThrows(() =>
      semver.intersect(new semver.Range("^1.1"), new semver.Range("^3"))
    )
  })

  it("hydrates.abseil.io", async function() {
    const pkgs = [
      { project: 'github.com/google/re2', constraint: new semver.Range('*') },
      { project: 'grpc.io', constraint: new semver.Range('*') }
    ]

    const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'github.com/google/re2') {
        return Promise.resolve([
          { project: 'abseil.io', constraint: new semver.Range('^20250127') }
        ])
      } else if (pkg.project === 'grpc.io') {
        return Promise.resolve([
          { project: 'abseil.io', constraint: new semver.Range('>=20250512') }
        ])
      } else {
        return Promise.resolve([])
      }
    })

    const constraints = constraintSet(rv.pkgs, 'abseil.io')
    assertEquals(constraints.size, 2)
    assert(constraints.has("^20250127"))
    assert(constraints.has(">=20250512"))
  })

  it("hydrates.multi-version.dry-input", async function() {
    // explicit +openssl^1.1 +openssl^3
    const pkgs = [
      { project: 'openssl.org', constraint: new semver.Range('^1.1') },
      { project: 'openssl.org', constraint: new semver.Range('^3') }
    ]

    const rv = await hydrate(pkgs, () => Promise.resolve([]))

    const constraints = constraintSet(rv.pkgs, 'openssl.org')
    assertEquals(constraints.size, 2)
    assert(constraints.has("^1.1"))
    assert(constraints.has("^3"))
    assertEquals(constraintSet(rv.dry, 'openssl.org').size, 2)
  })

  it("hydrates.multi-version.three-way", async function() {
    // cryptography first so ^3 is the graph node; both ^1.1 merge into one additional
    const pkgs = [
      { project: 'cryptography.io', constraint: new semver.Range('*') },
      { project: 'python.org', constraint: new semver.Range('*') },
      { project: 'curl.se', constraint: new semver.Range('*') }
    ]

    const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
      if (pkg.project === 'python.org' || pkg.project === 'curl.se') {
        return Promise.resolve([
          { project: 'openssl.org', constraint: new semver.Range('^1.1') }
        ])
      } else if (pkg.project === 'cryptography.io') {
        return Promise.resolve([
          { project: 'openssl.org', constraint: new semver.Range('^3') }
        ])
      } else {
        return Promise.resolve([])
      }
    })

    const constraints = constraintSet(rv.pkgs, 'openssl.org')
    assertEquals(constraints.size, 2)
    assert(constraints.has("^1.1"))
    assert(constraints.has("^3"))
  })

  it("hydrates.multi-version.dry-condense-compatible", async function() {
    const pkgs = [
      { project: 'openssl.org', constraint: new semver.Range('^1.1') },
      { project: 'openssl.org', constraint: new semver.Range('>=1.1.1') }
    ]

    const rv = await hydrate(pkgs, () => Promise.resolve([]))

    // compatible ranges collapse to a single openssl line (still on 1.x)
    const openssles = rv.pkgs.filter(p => p.project === 'openssl.org')
    assertEquals(openssles.length, 1)
    assertThrows(() =>
      semver.intersect(openssles[0].constraint, new semver.Range("^3"))
    )
  })
})
