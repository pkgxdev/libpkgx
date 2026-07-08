// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertFalse } from "@std/assert"
import { stub } from "@std/testing/mock"
import { useTestConfig, srcroot } from "../hooks/useTestConfig.ts"
import { _internals } from "../hooks/useFetch.ts"
import install from "./install.ts"
import SemVer from "../utils/semver.ts"
import host from "../utils/host.ts"

Deno.test("install bootstraps xz when system xz is missing", {
  ignore: Deno.build.os != 'linux' || Deno.env.get("PKGX_TEST_NO_SYSTEM_XZ") != '1'
}, async () => {
  assertFalse(exists("/usr/bin/xz"))
  assertFalse(exists("/bin/xz"))

  const { arch, platform } = host()
  const conf = useTestConfig()
  const pkg = { project: "foo.com", version: new SemVer("5.43.0") }
  const sha = "12ba4f3a0146f5fb11b6c796bc2e92a154a89bfb9cb2227cb5a9b95f6c2912bb"
  const fixture = srcroot.join("fixtures/foo.com-5.43.0.tar.xz")
  const cached = conf.cache.mkdir('p').join(`foo.com-5.43.0+${platform}+${arch}.tar.xz`)
  fixture.cp({ to: cached })

  const real_fetch = _internals.fetch
  const fetch_stub = stub(_internals, "fetch", async (opts, init) => {
    const url = opts as URL
    const path = url.pathname
    if (path.startsWith("/tukaani.org/xz/")) {
      return await real_fetch(opts, init)
    } else if (path.endsWith(".tar.xz.sha256sum")) {
      return new Response(`${sha}  ${url.pathname.split("/").at(-1)}\n`)
    } else if (path.endsWith(".tar.xz")) {
      return {status: 304, ok: true} as any
    } else {
      return new Response(undefined, { status: 404 })
    }
  })

  try {
    const installation = await install(pkg)
    assertEquals(installation.path, conf.prefix.join(pkg.project, `v${pkg.version}`))
    assert(installation.path.join("bin/foo").isExecutableFile())
    assert(conf.prefix.join("tukaani.org/xz/v5.8.3/bin/xz").isExecutableFile())
  } finally {
    fetch_stub.restore()
  }
})

function exists(path: string): boolean {
  try {
    return Deno.statSync(path).isFile
  } catch {
    return false
  }
}
