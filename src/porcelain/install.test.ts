import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assert } from "deno/testing/asserts.ts"
import * as semver from "../utils/semver.ts"
import install from "./install.ts"

Deno.test("porcelain.install.1", async () => {
  useTestConfig()
  const installations = await install("tea.xyz/brewkit")
  const projects = new Set(installations.map(x => x.pkg.project))
  assert(projects.has("tea.xyz/brewkit"))
})

Deno.test("porcelain.install.2", async () => {
  useTestConfig()
  await install("tea.xyz/brewkit^0.32")
})

Deno.test("porcelain.install.3", async () => {
  useTestConfig()
  const installations = await install(["tea.xyz/brewkit@0.31", "zlib.net"])
  const projects = new Set(installations.map(x => x.pkg.project))
  assert(projects.has("tea.xyz/brewkit"))
  assert(projects.has("zlib.net"))
})

Deno.test("porcelain.install.4", async () => {
  useTestConfig()
    await install([{ project: 'tea.xyz/brewkit', constraint: new semver.Range("^0.31") }])
})
