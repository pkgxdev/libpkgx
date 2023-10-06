import { assert, assertEquals, assertThrows, fail } from "deno/assert/mod.ts"
import host, { _internals, SupportedPlatform } from "./host.ts"
import { stub } from "deno/testing/mock.ts"

Deno.test({
  name:"host()",
  ignore: Deno.build.os == 'windows',
  async fn()
{
  const uname = [await run("uname"), await run("uname -m")]

  const { platform, arch } = host()
  switch (uname[0]) {
  case "Darwin":
    assertEquals(platform, "darwin")
    break
  case "Linux":
    assertEquals(platform, "linux")
    break
  default:
    fail()
  }

  switch (uname[1]) {
  case "aarch64":
  case "arm64":
    assertEquals(arch, "aarch64")
    break
  case "x86_64":
    assertEquals(arch, "x86-64")
    break
  default:
    fail()
  }

  async function run(cmd: string) {
    // deno’s shims don’t support Deno.Command yet
    // deno-lint-ignore no-deprecated-deno-api
    const proc = Deno.run({ cmd: cmd.split(" "), stdout: "piped" })
    assert((await proc.status()).success)
    const out = await proc.output()
    proc.close()
    return new TextDecoder().decode(out).trim()
  }
}})

Deno.test({
  name: "host()",
  ignore: Deno.build.os != 'windows',
  fn() {
    assertEquals(host().platform, "windows")
    assertEquals(host().arch, "x86-64")
  }
})

Deno.test("host().windows.arm64", () => {
  const s1 = stub(_internals, "platform", () => "windows" as SupportedPlatform)
  const s2 = stub(_internals, "arch", () => "arm64" as "arm64" | "x64")
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
  const s1 = stub(_internals, "arch", () => "foo" as "arm64" | "x64")
  try {
    assertThrows(host)
  } finally {
    s1.restore()
  }
})
