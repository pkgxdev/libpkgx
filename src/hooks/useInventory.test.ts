// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals } from "deno/assert/assert_equals.ts"
import SemVer, * as semver from "../utils/semver.ts"
import { assertRejects } from "deno/assert/mod.ts"
import * as mock from "deno/testing/mock.ts"
import { _internals } from "./useFetch.ts"
import specimen from "./useInventory.ts"

Deno.test("useInventory", async runner => {
  await runner.step("select()", async () => {
    const stub = mock.stub(_internals, "fetch", async () => {
      return {
        ok: true,
        status: 200,
        async text() {
          return "1.2.3\n1.2.4"
        }
      } as any
    })

    try {
      assertEquals(
        (await specimen().select({project: "foo", version: new SemVer("1.2.3")}))?.toString(),
        "1.2.3"
      )

      assertEquals(
        (await specimen().select({project: "foo", constraint: new semver.Range("=1.2.3")}))?.toString(),
        "1.2.3"
      )
    } finally {
      stub.restore()
    }
  })

  await runner.step("fail HTTP", async () => {
    const stub = mock.stub(_internals, "fetch", async () => {
      return {
        ok: false,
        status: 404
      } as any
    })

    try {
      assertRejects(() => specimen().select({project: "foo", version: new SemVer("1.2.3")}))
    } finally {
      stub.restore()
    }
  })

  await runner.step("fail no versions", async () => {
    const stub = mock.stub(_internals, "fetch", async () => {
      return {
        ok: true,
        status: 200,
        async text() { return "" }
      } as any
    })

    try {
      assertRejects(() => specimen().select({project: "foo", version: new SemVer("1.2.3")}))
    } finally {
      stub.restore()
    }
  })

  await runner.step("openssl hack", async () => {
    const stub = mock.stub(_internals, "fetch", async () => {
      return {
        ok: true,
        status: 200,
        async text() { return "1.1.118\n1.1.117" }
      } as any
    })

    try {
      assertEquals(
        (await specimen().select({project: "openssl.org", constraint: new semver.Range("^1")}))?.toString(),
        "1.1.117")
    } finally {
      stub.restore()
    }
  })
})
