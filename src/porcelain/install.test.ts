// deno-lint-ignore-file require-await no-explicit-any
import { useTestConfig } from "../hooks/useTestConfig.ts"
import SemVer, * as semver from "../utils/semver.ts"
import install, { ConsoleLogger, _internals } from "./install.ts"
import { assert, assertEquals } from "jsr:@std/assert"
import type { Installation } from "../types.ts"
import usePantry from "../hooks/usePantry.ts"
import useConfig from "../hooks/useConfig.ts"
import { stub } from "jsr:@std/testing/mock"
import Path from "../utils/Path.ts";

Deno.test("porcelain.install", async () => {
  useTestConfig()
  usePantry().prefix.rm({ recursive: true })

  const stub1 = stub(_internals, "hydrate", async () => ({
    pkgs: [
      {project: "foo.com", constraint: new semver.Range("*")},
      {project: "bar.org", constraint: new semver.Range("^2")}
    ]
  } as any))

  const stub2 = stub(_internals, "resolve", async () => ({
    pending: [{project: "foo.com", version: new SemVer("1.0.0")}],
    installed: [{ pkg: {project: "bar.org", version: new SemVer("2.3.4")}, path: Path.root}],
    pkgs: []
  }))

  const stub3 = stub(_internals, "link", async (install) =>
    assertEquals((install as any).pkg.project, "foo.com")
  )

  const installation: Installation = {
    pkg: {
      project: "foo.com",
      version: new SemVer("1.0.0")
    },
    path: useConfig().prefix.join("foo.com", "v1.0.0")
  }

  const stub4 = stub(_internals, "install", async ({ project }, logger) => {
    assertEquals(project, "foo.com")

    // for coverage
    logger!.installing!({ pkg: installation.pkg, progress: 1 })
    logger!.downloading!({pkg: installation.pkg, src: new URL("http://example.com"), dst: Path.root, rcvd: 0, total: 100})

    return installation
  })

  const stub5 = stub(_internals, "useSync", async () => {})

  try {
    const installations = await install("foo.com", ConsoleLogger({prefix: "test"}))
    assertEquals(installations.length, 2)
    assertEquals(installations[0].pkg.project, "bar.org")
    assertEquals(installations[1].pkg.project, "foo.com")
  } finally {
    stub1.restore()
    stub2.restore()
    stub3.restore()
    stub4.restore()
  }

  assertEquals(stub1.calls.length, 1)
  assertEquals(stub2.calls.length, 1)
  assertEquals(stub3.calls.length, Deno.build.os == 'windows' ? 0 : 1)
  assertEquals(stub4.calls.length, 1)
  assertEquals(stub5.calls.length, 1)
})
