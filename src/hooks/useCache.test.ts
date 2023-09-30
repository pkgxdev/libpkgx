import { Stowage, StowageNativeBottle } from "../types.ts"
import { assertEquals } from "deno/assert/mod.ts"
import SemVer from "../utils/semver.ts"
import useConfig from "./useConfig.ts"
import useCache from "./useCache.ts"
import host from "../utils/host.ts"

Deno.test("useCache", () => {
  const { cache } = useConfig()
  const hw = (({ platform, arch }) => `${platform}+${arch}`)(host())

  const stowage = StowageNativeBottle({
    pkg: { project: "foo/bar", version: new SemVer("1.0.0") },
    compression: "xz"
  });
  assertEquals(useCache().path(stowage), cache.join(`foo∕bar-1.0.0+${hw}.tar.xz`))

  const stowage2: Stowage = {
    type: 'bottle',
    pkg: stowage.pkg,
    host: { platform: "linux", arch: "aarch64" },
    compression: 'xz'
  }
  assertEquals(useCache().path(stowage2), cache.join("foo∕bar-1.0.0+linux+aarch64.tar.xz"))

  const stowage3: Stowage = {
    pkg: stowage.pkg,
    type: "src",
    extname: ".tgz"
  }
  assertEquals(useCache().path(stowage3), cache.join("foo∕bar-1.0.0.tgz"))
})
