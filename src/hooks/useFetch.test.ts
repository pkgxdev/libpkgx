import { stub, assertSpyCallArgs } from "deno/testing/mock.ts"
import { useTestConfig } from "./useTestConfig.ts";
import useFetch, { _internals } from "./useFetch.ts"


Deno.test({
  name: "fetch user-agent header check",
  async fn() {
    const UserAgent = "tests/1.2.3"
    useTestConfig({ UserAgent })

    const url = "https://example.com";
    const fetchStub = stub(
      _internals,
      "fetch",
      () => Promise.resolve(new Response("")),
    );

    try {
      await useFetch(url, {});
    } finally {
      fetchStub.restore();
    }

    assertSpyCallArgs(fetchStub, 0, [url, {
      headers: {"User-Agent": UserAgent}
    }]);
  }
});
