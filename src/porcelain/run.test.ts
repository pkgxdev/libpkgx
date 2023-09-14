import { assertEquals, assertMatch, assertRejects } from "deno/testing/asserts.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import run from "./run.ts"

Deno.test("porcelain.run", async (runner) => {
  await runner.step("std", async () => {
    useTestConfig()
    const { stdout, stderr, status } = await run(`python -c 'print(1)'`) as unknown as {
      stdout: string
      stderr: string
      status: number
    }
    // ^^ type system hack to ensure we don’t actually capture the stdout/stderr
    assertEquals(stdout, "")
    assertEquals(stderr, "")
    assertEquals(status, 0)
  })

  // we had a scenario where no args would truncate the cmd-name
  await runner.step("no args works", async () => {
    useTestConfig()
    const { stdout, stderr, status } = await run(`ls`) as unknown as {
      stdout: string
      stderr: string
      status: number
    }
    assertEquals(stdout, "")
    assertEquals(stderr, "")
    assertEquals(status, 0)
  })

  await runner.step("node^16", async (runner) => {
    useTestConfig()
    await runner.step("string", async () => {
      const { stdout } = await run("node^16 --version", { stdout: true })
      assertMatch(stdout, /^v16\./)
    })

    await runner.step("array", async () => {
      const { stdout } = await run(["node^16", "--version"], { stdout: true })
      assertMatch(stdout, /^v16\./)
    })
  })

  await runner.step("env", async () => {
    useTestConfig()
    await run(["node", "-e", 'if (process.env.FOO !== "FOO") throw new Error()'], {
      env: { FOO: "FOO" },
    })
  })

  await runner.step("status", async () => {
    useTestConfig()
    const { status } = await run(`python -c 'import sys; sys.exit(7)'`, { status: true })
    assertEquals(status, 7)
  })

  await runner.step("throws", async () => {
    useTestConfig()
    await assertRejects(() => run(`python -c 'import sys; sys.exit(7)'`))
  })

  await runner.step("stdout", async () => {
    useTestConfig()
    const { stdout } = await run(["python", "-c", "import os; print(os.getenv('FOO'))"], {
      stdout: true,
      env: { FOO: "FOO" },
    })
    assertEquals(stdout, "FOO\n")
  })

  await runner.step("stderr", async () => {
    useTestConfig()
    const { stderr } = await run(["node", "-e", "console.error(process.env.FOO)"], {
      stderr: true,
      env: { FOO: "BAR" },
    })
    assertEquals(stderr, "BAR\n")
  })

  await runner.step("all", async () => {
    useTestConfig()
    const { stderr, stdout, status } = await run([
      "node",
      "-e",
      "console.error(1); console.log(2); process.exit(3)",
    ], { stderr: true, stdout: true, status: true })
    assertEquals(stderr, "1\n")
    assertEquals(stdout, "2\n")
    assertEquals(status, 3)
  })
})
