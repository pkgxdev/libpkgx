import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assertEquals } from "deno/assert/mod.ts"
import undent from "outdent"
import run from "./run.ts"

Deno.test("porcelain.run", async runner => {

  const { prefix } = useTestConfig()

  const foo = prefix.join("foo.com/v5.43.0/bin").mkdir("p")

  if (Deno.build.os != 'windows') {
    foo.join("foo").write({ text: undent`
      #!/bin/sh
      echo "abcdef--"
    `}).chmod(0o755)
  } else {
    foo.join("foo.bat").write({text: '@echo abcdef--'})
  }

  prefix.join("bar.com/v1.2.3").mkdir('p').join("not-empty").touch()

  await runner.step("std", async () => {
    await run("foo --args")
  })

  await runner.step("stdout", async () => {
    const { stdout } = await run(["foo", "--args"], {stdout: true})
    const nl = Deno.build.os === "windows" ? "\r\n" : "\n";
    assertEquals(stdout, `abcdef--${nl}`)
  })
})
