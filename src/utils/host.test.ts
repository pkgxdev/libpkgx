import { assertEquals } from "deno/testing/asserts.ts"
import host, { _internals } from "./host.ts"
import { stub } from "deno/testing/mock.ts"
import { SupportedArchitecture, SupportedPlatform } from "../types.ts"

Deno.test("host()", () => {
  const { platform, arch } = host()
  assertEquals(platform, Deno.build.os)

  switch (Deno.build.arch) {
  case "aarch64":
    assertEquals(arch, "aarch64")
    break
  case "x86_64":
    assertEquals(arch, "x86-64")
    break
  default:
    throw new Error()
  }
})

Deno.test("host().windows.arm64", () => {
  const s1 = stub(_internals, "platform", () => "windows" as SupportedPlatform)
  const s2 = stub(_internals, "arch", () => "aarch64" as SupportedArchitecture)
  try {
    const { platform, arch } = host()
    assertEquals(platform, "windows")
    assertEquals(arch, "aarch64")
  } finally {
    s1.restore()
    s2.restore()
  }
})
