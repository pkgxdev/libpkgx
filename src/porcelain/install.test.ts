import { assert, assertArrayIncludes } from "deno/assert/mod.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import type { Resolution } from "../plumbing/resolve.ts"
import install, { ConsoleLogger } from "./install.ts"
import * as semver from "../utils/semver.ts"
import type { Package } from "../types.ts"

Deno.test("porcelain.install.1", async () => {
  useTestConfig()
  const installations = await install("darwinsys.com/file")
  const projects = new Set(installations.map(x => x.pkg.project))
  assert(projects.has("darwinsys.com/file"))
})

Deno.test("porcelain.install.2", async () => {
  useTestConfig()
  await install("darwinsys.com/file^5")
})

Deno.test("porcelain.install.3", async () => {
  useTestConfig()
  const installations = await install(["darwinsys.com/file@5.45", "zlib.net"])
  const projects = new Set(installations.map(x => x.pkg.project))
  assert(projects.has("darwinsys.com/file"))
  assert(projects.has("zlib.net"))
})

Deno.test("porcelain.install.4", async () => {
  useTestConfig()
    await install([{ project: 'darwinsys.com/file', constraint: new semver.Range("^5.45") }])
})

Deno.test("porcelain.install.resolved", async () => {
  useTestConfig()

  let resolution: Resolution = { pkgs: [] as Package[] } as Resolution
  const logger = {
    ...ConsoleLogger(),
    resolved: (r: Resolution) => resolution = r
  }

  await install("curl.se", logger)

  const resolvedProjects = resolution.pkgs.map((p: Package) => p.project)
  assertArrayIncludes(resolvedProjects, [ "curl.se/ca-certs", "openssl.org", "curl.se"])
})
