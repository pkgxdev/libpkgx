// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert"
import SemVer, * as semver from "./semver.ts"


Deno.test("semver", async test => {
  await test.step("sort", () => {
    const input = [new SemVer([1,2,3]), new SemVer("10.3.4"), new SemVer("1.2.4"), semver.parse("1.2.3.1")!, new SemVer("2.3.4")]
    const sorted1 = [...input].sort(semver.compare)
    const sorted2 = [...input].sort()

    assertEquals(sorted1.join(", "), "1.2.3, 1.2.3.1, 1.2.4, 2.3.4, 10.3.4")

    /// we are showing we understand how vanilla JS works here
    assertEquals(sorted2.join(", "), "1.2.3, 1.2.3.1, 1.2.4, 10.3.4, 2.3.4")
  })

  await test.step("calver sort", () => {
    const input = [new SemVer([1,2,3]), new SemVer("2.3.4"), new SemVer("2023.03.04"), semver.parse("1.2.3.1")!, new SemVer([3,4,5])]
    const sorted1 = [...input].sort(semver.compare)
    const sorted2 = [...input].sort()

    assertEquals(sorted1.join(","), "2023.3.4,1.2.3,1.2.3.1,2.3.4,3.4.5")

    /// we are showing we understand how vanilla JS works here
    assertEquals(sorted2.join(","), "1.2.3,1.2.3.1,2.3.4,2023.3.4,3.4.5")
  })

  await test.step("parse", () => {
    assertEquals(semver.parse("1.2.3.4.5")?.toString(), "1.2.3.4.5")
    assertEquals(semver.parse("1.2.3.4")?.toString(), "1.2.3.4")
    assertEquals(semver.parse("1.2.3")?.toString(), "1.2.3")
    assertEquals(semver.parse("1.2")?.toString(), "1.2.0")
    assertEquals(semver.parse("1")?.toString(), "1.0.0")
  })

  await test.step("isValidSemVer", () => {
    assert(semver.isValid("1.2.3.4.5"))
    assert(semver.isValid("1a"))
    assert(semver.isValid("20.4"))
    assert(semver.isValid("2023.05.10"))
    assertFalse(semver.isValid("a"))
    assertFalse(semver.isValid("!#!@#!@#"))
  })

  await test.step("satisfies", () => {
    assertEquals(new semver.Range("=3.1.0").max([new SemVer("3.1.0")]), new SemVer("3.1.0"))

    // the following two test for https://github.com/pkgxdev/lib/pull/36
    assertEquals(new semver.Range("^300").max([new SemVer("3.1.0")]), undefined)
    assertEquals(new semver.Range("@300").max([new SemVer("3.1.0")]), undefined)
  })

  await test.step("constructor", () => {
    assertEquals(new SemVer("1.2.3.4.5.6").toString(), "1.2.3.4.5.6")
    assertEquals(new SemVer("1.2.3.4.5").toString(), "1.2.3.4.5")
    assertEquals(new SemVer("1.2.3.4").toString(), "1.2.3.4")
    assertEquals(new SemVer("1.2.3").toString(), "1.2.3")
    assertEquals(new SemVer("v1.2.3").toString(), "1.2.3")
    assertEquals(new SemVer("1.2").toString(), "1.2.0")
    assertEquals(new SemVer("v1.2").toString(), "1.2.0")
    assertEquals(new SemVer("1").toString(), "1.0.0")
    assertEquals(new SemVer("v1").toString(), "1.0.0")

    assertEquals(new SemVer("9e").toString(), "9e")
    assertEquals(new SemVer("9e").components, [9,5])
    assertEquals(new SemVer("3.3a").toString(), "3.3a")
    assertEquals(new SemVer("3.3a").components, [3,3,1])
    assertEquals(new SemVer("1.1.1q").toString(), "1.1.1q")
    assertEquals(new SemVer("1.1.1q").components, [1,1,1,17])
  })

  await test.step("ranges", () => {
    const a = new semver.Range(">=1.2.3<2.3.4 || >=3")
    assertEquals(a.toString(), ">=1.2.3<2.3.4,>=3")

    assert(a.satisfies(new SemVer("1.2.3")))
    assert(a.satisfies(new SemVer("1.4.1")))
    assert(a.satisfies(new SemVer("3.0.0")))
    assert(a.satisfies(new SemVer("90.0.0")))
    assertFalse(a.satisfies(new SemVer("2.3.4")))
    assertFalse(a.satisfies(new SemVer("2.5.0")))

    const b = new semver.Range("^0.15")
    // Due to the nature of the `^` operator, this
    // is the same as `~0.15`, and our code represents
    // it as such.
    assertEquals(b.toString(), "~0.15")

    const c = new semver.Range("~0.15")
    assertEquals(c.toString(), "~0.15")

    assert(c.satisfies(new SemVer("0.15.0")))
    assert(c.satisfies(new SemVer("0.15.1")))
    assertFalse(c.satisfies(new SemVer("0.14.0")))
    assertFalse(c.satisfies(new SemVer("0.16.0")))

    const d = new semver.Range("~0.15.1")
    assertEquals(d.toString(), "~0.15.1")
    assert(d.satisfies(new SemVer("0.15.1")))
    assert(d.satisfies(new SemVer("0.15.2")))
    assertFalse(d.satisfies(new SemVer("0.15.0")))
    assertFalse(d.satisfies(new SemVer("0.16.0")))
    assertFalse(d.satisfies(new SemVer("0.14.0")))

    // `~` is weird
    const e = new semver.Range("~1")
    assertEquals(e.toString(), "^1")
    assert(e.satisfies(new SemVer("v1.0")))
    assert(e.satisfies(new SemVer("v1.1")))
    assertFalse(e.satisfies(new SemVer("v2")))

    const f = new semver.Range("^14||^16||^18")
    assert(f.satisfies(new SemVer("14.0.0")))
    assertFalse(f.satisfies(new SemVer("15.0.0")))
    assert(f.satisfies(new SemVer("16.0.0")))
    assertFalse(f.satisfies(new SemVer("17.0.0")))
    assert(f.satisfies(new SemVer("18.0.0")))

    const g = new semver.Range("<15")
    assert(g.satisfies(new SemVer("14.0.0")))
    assert(g.satisfies(new SemVer("0.0.1")))
    assertFalse(g.satisfies(new SemVer("15.0.0")))

    const i = new semver.Range("^1.2.3.4")
    assert(i.satisfies(new SemVer("1.2.3.4")))
    assert(i.satisfies(new SemVer("1.2.3.5")))
    assert(i.satisfies(new SemVer("1.2.4.2")))
    assert(i.satisfies(new SemVer("1.3.4.2")))
    assertFalse(i.satisfies(new SemVer("2.0.0")))

    const j = new semver.Range("^0.1.2.3")
    assert(j.satisfies(new SemVer("0.1.2.3")))
    assert(j.satisfies(new SemVer("0.1.3")))
    assertFalse(j.satisfies(new SemVer("0.2.0")))

    const k = new semver.Range("^0.0.1.2")
    assertFalse(k.satisfies(new SemVer("0.0.1.1")))
    assert(k.satisfies(new SemVer("0.0.1.2")))
    assert(k.satisfies(new SemVer("0.0.1.9")))
    assertFalse(k.satisfies(new SemVer("0.0.2.0")))

    const l = new semver.Range("^0.0.0.1")
    assertFalse(l.satisfies(new SemVer("0.0.0.0")))
    assert(l.satisfies(new SemVer("0.0.0.1")))
    assertFalse(l.satisfies(new SemVer("0.0.0.2")))

    // This one is weird, but it should mean "<1"
    const m = new semver.Range("^0")
    assert(m.satisfies(new SemVer("0.0.0")))
    assert(m.satisfies(new SemVer("0.0.1")))
    assert(m.satisfies(new SemVer("0.1.0")))
    assert(m.satisfies(new SemVer("0.9.1")))
    assertFalse(m.satisfies(new SemVer("1.0.0")))

    assertThrows(() => new semver.Range("1"))
    assertThrows(() => new semver.Range("1.2"))
    assertThrows(() => new semver.Range("1.2.3"))
    assertThrows(() => new semver.Range("1.2.3.4"))

    assertEquals(new semver.Range("@300").toString(), "^300")
    assertEquals(new semver.Range("@300.1").toString(), "~300.1")
    assertEquals(new semver.Range("@300.1.0").toString(), "@300.1.0")
    assertEquals(new semver.Range(">=300.1.0<300.1.1").toString(), "@300.1.0")
  })

  await test.step("intersection", async test => {
    await test.step("^3.7…=3.11", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("=3.11")

      assertEquals(b.toString(), "=3.11.0")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "=3.11.0")
    })

    await test.step("^3.7…^3.9", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("^3.9")

      assertEquals(b.toString(), "^3.9")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "^3.9")
    })

    await test.step("^3.7…*", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("*")

      assertEquals(b.toString(), "*")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "^3.7")
    })

    await test.step("~3.7…~3.8", () => {
      const a = new semver.Range("~3.7")
      const b = new semver.Range("~3.8")

      assertThrows(() => semver.intersect(a, b))
    })

    await test.step("^3.7…=3.8", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("=3.8")
      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "=3.8.0")
    })

    await test.step("^11,^12…^11.3", () => {
      const a = new semver.Range("^11,^12")
      const b = new semver.Range("^11.3")
      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "^11.3")
    })

    await test.step(">=11<12", () => {
      const a = new semver.Range(">=11<12")
      const b = new semver.Range(">=11.0.0 <13.0.0.0")
      //assertEquals(a.toString(), "^11.3")
      assert(a.satisfies(new SemVer("11.0.0")))
      assert(a.satisfies(new SemVer("11.9.0")))
      assert(b.satisfies(new SemVer("11.0.0")))
      assert(b.satisfies(new SemVer("11.9.0")))
      assert(b.satisfies(new SemVer("12.9.0")))
    })

    await test.step(">=0.47<1", () => {
      const a = new semver.Range(">=0.47<1")
      assertEquals(a.toString(), ">=0.47<1")
      assert(a.satisfies(new SemVer("0.47.0")))
      assert(a.satisfies(new SemVer("0.47.9")))
      assert(a.satisfies(new SemVer("0.48.0")))
      assert(a.satisfies(new SemVer("0.80.0")))
      assertFalse(a.satisfies(new SemVer("1.0.0")))
    })

    await test.step("^0 string is not @0.0.0", () => {
      const a = new semver.Range("^0")
      assertEquals(a.toString(), "^0")

      const b = new semver.Range("^0.0")
      assertEquals(b.toString(), "~0") //NOTE strictly should be ~0.0 but this is fine

      const c = new semver.Range("^1")
      assertEquals(c.toString(), "^1")

      const d = new semver.Range("^1.0")
      assertEquals(d.toString(), "^1")
    })

    //FIXME this *should* work
    // await test.step("^11,^12…^11.3,^12.2", () => {
    //   const a = new semver.Range("^11,^12")
    //   const b = new semver.Range("^11.3")
    //   const c = semver.intersect(a, b)
    //   assertEquals(c.toString(), "^11.3,^12.2")
    // })

    /* https://github.com/pkgxdev/libpkgx/issues/42 */
    await test.step(">=1<1.0.19", async test => {
      await test.step("1", () => { new semver.Range(">=1<1.0.19") })
      await test.step("2", () => { new semver.Range(">=1.0<1.0.19") })
      await test.step("3", () => {
        assertEquals(new semver.Range(">=1<2").toString(), "^1")
      })

      assert(new SemVer("1").lt(new SemVer("1.0.19")), "1.0.0 is less than 1.0.19")
    })
  })
})

Deno.test("coverage", () => {
  assert(new SemVer("1.2.3").eq(new SemVer([1,2,3])))
  assert(new SemVer("1.2.3").neq(new SemVer([1,2,4])))
  assert(new SemVer("1.2.3").lt(new SemVer([1,2,4])))
  assert(new SemVer("1.2.4").gt(new SemVer([1,2,3])))

  assertThrows(() => new SemVer("1.q.3"))

  assert(semver.Range.parse("^1")?.satisfies(new SemVer("1.2.3")))

  assertEquals(new semver.Range("=1.0.0").single(), new SemVer("1.0.0"))

  assertEquals((new semver.Range("^1") as any)[Symbol.for("Deno.customInspect")](), "^1")
  assertEquals((new SemVer("1.2.3") as any)[Symbol.for("Deno.customInspect")](), "1.2.3")

  assert(semver.parse("a") == undefined)

  assertThrows(() => new semver.Range(">=3<2"))
  assertThrows(() => new semver.Range(""))

  assertEquals(new SemVer(new SemVer("1.2.3")), new SemVer("1.2.3"))
  assertEquals(new SemVer(new semver.Range("=1.0.0")), new SemVer("1.0.0"))
  assertThrows(() => new SemVer(new semver.Range("^1")))

  assertThrows(() => new semver.Range("1"))

  assertEquals(semver.Range.parse("1")?.toString(), new semver.Range("^1").toString())
  assertEquals(semver.Range.parse("1.1")?.toString(), new semver.Range("~1.1").toString())
  assertEquals(semver.Range.parse("1.1.2")?.toString(), new semver.Range("@1.1.2").toString())

  assertEquals(semver.Range.parse("a"), undefined)

  assertEquals(new semver.Range("*").toString(), "*")

  assert(new semver.Range("*").satisfies(new SemVer("1.2.3")))

  assertEquals(new semver.Range("^1").max([new SemVer("1.2.3"), new SemVer("1.2.4")]), new SemVer("1.2.4"))

  assertEquals(new semver.Range("*").single(), undefined)

  assert(semver.intersect(new semver.Range("*"), new semver.Range("^2")))
  assert(semver.intersect(new semver.Range("^2"), new semver.Range("*")))


  assertEquals(new semver.Range("^1.2.0").toString(), "^1.2")
})
