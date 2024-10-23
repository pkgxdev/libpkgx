import { assertEquals } from "@std/assert"
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
