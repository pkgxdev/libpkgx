import { useTestConfig } from "./useTestConfig.ts"
import { assert } from "deno/testing/asserts.ts"
import useDownload from "./useDownload.ts"

Deno.test("etag-mtime-check", async (runner) => {
  useTestConfig({ TEA_CACHE_DIR: Deno.makeTempDirSync() })

  const src = new URL("https://dist.tea.xyz/ijg.org/versions.txt")
  const { download, cache } = useDownload()

  await runner.step("download", async () => {
    await download({ src })

    const mtimePath = cache({ for: src }).join("mtime")
    const etagPath = cache({ for: src }).join("etag")

    const mtime = await mtimePath.read()
    const etag = await etagPath.read()

    const rsp = await fetch(src, {})
    const mtimeA = rsp.headers.get("Last-Modified")
    const etagA = rsp.headers.get("etag")

    assert(mtimeA === mtime)
    assert(etagA === etag)

    await rsp.body?.cancel()
  })

  await runner.step("second download doesn’t http", async () => {
    let n = 0
    await download({ src }, (blob) => {
      n += blob.length
      return Promise.resolve()
    }) // for coverage
    assert(n > 0)
  })

  await runner.step("second download doesn’t http and is fine if we do nothing", async () => {
    const dst = await download({ src })
    assert(dst.isFile())
  })
})
