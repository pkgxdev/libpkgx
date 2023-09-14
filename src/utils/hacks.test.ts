import { assertEquals, assertThrows } from "deno/testing/asserts.ts"
import { validatePackageRequirement } from "./hacks.ts"
import host from "./host.ts"

Deno.test("validatePackageRequirement - valid input", () => {
  const result = validatePackageRequirement("tea.xyz/test", "^1.0.0")
  assertEquals(result?.project, "tea.xyz/test")
  assertEquals(result?.constraint.toString(), "^1")
})

Deno.test("validatePackageRequirement - invalid constraint", () => {
  assertThrows(() => validatePackageRequirement("tea.xyz/test", "nonsense"))
})

Deno.test("validatePackageRequirement - number constraint", () => {
  const result = validatePackageRequirement("tea.xyz/test", 1)
  assertEquals(result?.constraint.toString(), "^1")
})

Deno.test("validatePackageRequirement - hacks", () => {
  const result = validatePackageRequirement("tea.xyz/gx/cc", "c99")
  assertEquals(result?.constraint.toString(), "~0.1")
})

Deno.test({
  name: "validatePackageRequirement - darwin hack",
  ignore: Deno.build.os !== "darwin",
  fn: () => {
    const result = validatePackageRequirement("apple.com/xcode/clt", "*")
    assertEquals(result, undefined)
  },
})

Deno.test("validatePackageRequirement - linux hack", () => {
  if (host().platform !== "linux") return

  const result = validatePackageRequirement("tea.xyz/gx/make", "*")

  assertEquals(result?.project, "gnu.org/make")
  assertEquals(result?.constraint.toString(), "*")
})
