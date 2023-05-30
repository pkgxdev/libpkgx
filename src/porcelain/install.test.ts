import { assertEquals } from "https://deno.land/std@0.189.0/testing/asserts.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import * as semver from "../utils/semver.ts"
import install from "./install.ts"

Deno.test("porcelain.install.1", async () => {
  useTestConfig()
  const installations = await install("tea.xyz/brewkit")
  assertEquals(installations[0].pkg.project, "tea.xyz/brewkit")
})

Deno.test("porcelain.install.2", async () => {
  useTestConfig()
  await install("tea.xyz/brewkit^0.32")
})

Deno.test("porcelain.install.3", async () => {
  useTestConfig()
    await install(["tea.xyz/brewkit@0.31"])
})

Deno.test("porcelain.install.4", async () => {
  useTestConfig()
    await install([{ project: 'tea.xyz/brewkit', constraint: new semver.Range("^0.31") }])
})
