import { assertEquals, assertRejects } from "deno/testing/asserts.ts"
import { useTestConfig } from "../hooks/useTestConfig.ts"
import run from "./run.ts"

Deno.test("porcelain.runx", async runner => {
  await runner.step(async function std() {
    useTestConfig()
    const { stdout, stderr, status } = await run(`python -c 'print(1)'`) as unknown as { stdout: string, stderr: string, status: number }
    assertEquals(stdout, "")
    assertEquals(stderr, "")
    assertEquals(status, 0)
  })

  await runner.step(async function status() {
    useTestConfig()
    const { status } = await run(`python -c 'import sys; sys.exit(7)'`, { status: true })
    assertEquals(status, 7)
  })

  await runner.step(async function throws() {
    useTestConfig()
    await assertRejects(() => run(`python -c 'import sys; sys.exit(7)'`))
  })

  await runner.step(async function stdout() {
    useTestConfig()
    const { stdout } = await run(['python', '-c', "import os; print(os.getenv('FOO'))"], { stdout: true, env: { FOO: "FOO" } })
    assertEquals(stdout, "FOO\n")
  })

  await runner.step(async function stderr() {
    useTestConfig()
    const { stderr } = await run(['node', '-e', "console.error(process.env.FOO)"], { stderr: true, env: { FOO: "BAR" } })
    assertEquals(stderr, "BAR\n")
  })

  await runner.step(async function all() {
    useTestConfig()
    const { stderr, stdout, status } = await run(['node', '-e', "console.error(1); console.log(2); process.exit(3)"], { stderr: true, stdout: true, status: true })
    assertEquals(stderr, "1\n")
    assertEquals(stdout, "2\n")
    assertEquals(status, 3)
  })
})
