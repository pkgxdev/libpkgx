import { assertSpyCallArgs, stub } from "deno/testing/mock.ts"
import useConfig, { _internals, ConfigDefault } from "./useConfig.ts"
import useFetch from "./useFetch.ts"

Deno.test("fetch user-agent header check", async () => {
  /// doesn't work inside DNT because fetch is shimmed to undici
  if (Deno.env.get("NODE")) return

  const UserAgent = "tests/1.2.3"

  _internals.reset()
  useConfig({ ...ConfigDefault(), UserAgent })

  const url = "https://example.com"
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response("")),
  )

  try {
    await useFetch(url, {})
  } finally {
    fetchStub.restore()
  }

  assertSpyCallArgs(fetchStub, 0, [url, {
    headers: { "User-Agent": UserAgent },
  }])
})
