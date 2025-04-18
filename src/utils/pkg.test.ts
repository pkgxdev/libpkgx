import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert"
import SemVer, { Range } from "./semver.ts"
import * as pkg from "./pkg.ts"

Deno.test("pkg.str", async test => {
  let out: string

  await test.step("precise", () => {
    out = pkg.str({
      project: "test",
      version: new SemVer("1.2.3")
    })
    assertEquals(out, "test=1.2.3")
  })

  for (const range of ["^1", "^1.2", "^1.2.3"]) {
    await test.step(range, () => {
      out = pkg.str({
        project: "test",
        constraint: new Range(range)
      })
      assertEquals(out, `test${range}`)
    })
  }

  for (const [range, expected] of [[">=1 <2", "^1"], [">=1.2 <2", "^1.2"], [">=1.2.3 <2", "^1.2.3"]]) {
    await test.step(`${range} == ${expected}`, () => {
      out = pkg.str({
        project: "test",
        constraint: new Range(range)
      })
      assertEquals(out, `test${expected}`)
    })
  }

  await test.step("range of one version", () => {
    const constraint = new Range("=1.2.3")

    out = pkg.str({
      project: "test",
      constraint
    })
    assert(constraint.single())
    assertEquals(out, `test=1.2.3`)
  })
})

Deno.test("pkg.parse", async test => {
  await test.step("@5", () => {
    const { constraint } = pkg.parse("test@5")
    assert(constraint.satisfies(new SemVer([5,0,0])))
    assert(constraint.satisfies(new SemVer([5,1,0])))
    assertFalse(constraint.satisfies(new SemVer([6,0,0])))
  })

  await test.step("@5.0", () => {
    const { constraint } = pkg.parse("test@5.0")
    assert(constraint.satisfies(new SemVer([5,0,0])))
    assert(constraint.satisfies(new SemVer([5,0,1])))
    assertFalse(constraint.satisfies(new SemVer([5,1,0])))
  })

  await test.step("@5.0.0", () => {
    const { constraint } = pkg.parse("test@5.0.0")
    assert(constraint.satisfies(new SemVer([5,0,0])))
    assert(constraint.satisfies(new SemVer([5,0,0,1])))
    assertFalse(constraint.satisfies(new SemVer([5,0,1])))
  })

  await test.step("bad input", () => {
    assertThrows(() => pkg.parse("asdf^@~"), "invalid pkgspec: asdf^@~")
  })

  await test.step("leading & trailing space", () => {
    const { constraint } = pkg.parse(" test@5\t")
    assert(constraint.satisfies(new SemVer([5,0,0])))
  })
})

Deno.test("pkg.compare", async test => {
  await test.step("compare versions", () => {
    const a = { project: "test", version: new SemVer("1.2.3") }
    const b = { project: "test", version: new SemVer("2.1.3") }
    assert(pkg.compare(a, b) < 0)
  })

  await test.step("compare pkg names", () => {
    const a = { project: "a", version: new SemVer("1.2.3") }
    const b = { project: "b", version: new SemVer("1.2.3") }
    assert(pkg.compare(a, b) < 0)
  })
})
