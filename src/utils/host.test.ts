import { assertEquals, assertThrows } from "deno/testing/asserts.ts"
import { SupportedPlatform } from "../types.ts"
import host, { _internals } from "./host.ts"
import { stub } from "deno/testing/mock.ts"

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
  const s2 = stub(_internals, "arch", () => "aarch64" as "aarch64" | "x86_64")
  try {
    const { platform, arch } = host()
    assertEquals(platform, "windows")
    assertEquals(arch, "aarch64")
  } finally {
    s1.restore()
    s2.restore()
  }
})

Deno.test("host().aix.x", () => {
  const s1 = stub(_internals, "platform", () => "aix" as SupportedPlatform)
  try {
    const { platform } = host()
    assertEquals(platform, "linux")
  } finally {
    s1.restore()
  }
})

Deno.test("host().x.foo", () => {
  const s1 = stub(_internals, "arch", () => "foo" as "aarch64" | "x86_64")
  try {
    assertThrows(host)
  } finally {
    s1.restore()
  }
})
