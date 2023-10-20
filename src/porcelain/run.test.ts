import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assertEquals, assertRejects } from "deno/assert/mod.ts"
import undent from "outdent"
import run from "./run.ts"

Deno.test("porcelain.run", async runner => {

  const { prefix } = useTestConfig()

  const foo = prefix.join("foo.com/v5.43.0/bin").mkdir("p")

  if (Deno.build.os != 'windows') {
    foo.join("foo").write({ text: undent`
      #!/bin/sh
      if [ "$1" = "--fail" ]; then exit 1; fi
      echo "abcdef--"
      echo "ghijkl--" 1>&2
    `}).chmod(0o755)
  } else {
    foo.join("foo.bat").write({text: undent`
      @echo off
      IF "%~1"=="--fail" ( exit /b 1 )
      echo abcdef--
      echo ghijkl-- 1>&2
      `})
  }

  prefix.join("bar.com/v1.2.3").mkdir('p').join("not-empty").touch()

  await runner.step("std", async () => {
    await run("foo --args")
    await run("foo")  // tests no spaces branch

    await assertRejects(() => run([]))
  })

  await runner.step("std(out|err)", async () => {
    const { stdout } = await run(["foo", "--args"], {stdout: true})
    const nl = Deno.build.os === "windows" ? "\r\n" : "\n";
    assertEquals(stdout, `abcdef--${nl}`)

    const { stderr } = await run(["foo", "--args"], {stderr: true})
    const expected = Deno.build.os === "windows" ? 'ghijkl-- \r\n' : 'ghijkl--\n'
    assertEquals(stderr, expected)
  })

  await runner.step("cmd fails", async () => {
    await assertRejects(() => run(["foo", "--fail"]))
  })
})
