import { assertEquals, assert } from "@std/assert"
import { useTestConfig } from "./useTestConfig.ts"
import useShellEnv from "./useShellEnv.ts"
import SemVer from "../utils/semver.ts"

Deno.test("useShellEnv", async () => {
  const { map, flatten } = useShellEnv()
  const { prefix } = useTestConfig()

  const installations = [{
    pkg: { project: 'python.org', version: new SemVer('3.9.1') },
    path: prefix.join("python.org/v3.9.1")
  }, {
    pkg: { project: 'npmjs.com', version: new SemVer('3.9.1') },
    path: prefix.join("npmjs.com/v3.9.1")
  }]

  installations[0].path.join("bin").mkdir('p')
  installations[1].path.join("bin").mkdir('p')

  const env = flatten(await map({ installations }))

  const SEP = Deno.build.os == 'windows' ? ';' : ':'

  assertEquals(env.PATH, `${installations[0].path.join("bin")}${SEP}${installations[1].path.join("bin")}`)
})

Deno.test("useShellEnv: gnu.org/glibc does not export lib/ to LIBRARY_PATH", async () => {
  // Regression test for libc-style bottles polluting consumers'
  // LD_LIBRARY_PATH and breaking the host's coreutils.
  const { map } = useShellEnv()
  const { prefix } = useTestConfig()

  const glibc_install = {
    pkg: { project: 'gnu.org/glibc', version: new SemVer('2.43.0') },
    path: prefix.join("gnu.org/glibc/v2.43.0"),
  }
  const curl_install = {
    pkg: { project: 'curl.se', version: new SemVer('8.13.0') },
    path: prefix.join("curl.se/v8.13.0"),
  }

  // Both bottles have a populated lib/ directory.
  glibc_install.path.join("lib").mkdir('p')
  curl_install.path.join("lib").mkdir('p')

  const vars = await map({ installations: [glibc_install, curl_install] })

  // curl's lib/ is still exposed (existing behaviour).
  const lib_paths = vars.LIBRARY_PATH ?? []
  assert(
    lib_paths.some(p => p.endsWith("curl.se/v8.13.0/lib")),
    `expected curl's lib/ in LIBRARY_PATH, got: ${lib_paths.join(", ")}`,
  )
  // glibc's lib/ is NOT — that's the new opt-out behaviour.
  assert(
    !lib_paths.some(p => p.endsWith("gnu.org/glibc/v2.43.0/lib")),
    `glibc's lib/ should not be in LIBRARY_PATH, got: ${lib_paths.join(", ")}`,
  )
})
