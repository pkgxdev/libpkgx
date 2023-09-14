import { assert, assertArrayIncludes } from "deno/testing/asserts.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import type { Resolution } from "../plumbing/resolve.ts"
import install, { ConsoleLogger } from "./install.ts"
import * as semver from "../utils/semver.ts"
import type { Package } from "../types.ts"

Deno.test("porcelain.install.1", async () => {
  useTestConfig()
  const installations = await install("tea.xyz/brewkit")
  const projects = new Set(installations.map((x) => x.pkg.project))
  assert(projects.has("tea.xyz/brewkit"))
})

Deno.test("porcelain.install.2", async () => {
  useTestConfig()
  await install("tea.xyz/brewkit^0.32")
})

Deno.test("porcelain.install.3", async () => {
  useTestConfig()
  const installations = await install(["tea.xyz/brewkit@0.31", "zlib.net"])
  const projects = new Set(installations.map((x) => x.pkg.project))
  assert(projects.has("tea.xyz/brewkit"))
  assert(projects.has("zlib.net"))
})

Deno.test("porcelain.install.4", async () => {
  useTestConfig()
  await install([{ project: "tea.xyz/brewkit", constraint: new semver.Range("^0.31") }])
})

Deno.test("porcelain.install.resolved", async () => {
  useTestConfig()

  let resolution: Resolution = { pkgs: [] as Package[] } as Resolution
  const logger = {
    ...ConsoleLogger(),
    resolved: (r: Resolution) => resolution = r,
  }

  await install("tea.xyz/brewkit^0.32", logger)

  const resolvedProjects = resolution.pkgs.map((p: Package) => p.project)
  assertArrayIncludes(resolvedProjects, ["deno.land", "gnu.org/bash", "tea.xyz", "tea.xyz/brewkit"])
})
