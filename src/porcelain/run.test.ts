import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assertEquals, assertRejects } from "deno/testing/asserts.ts"
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
})

// Deno.test("porcelain.spawn", async () => {
//   useTestConfig()
//   const proc = await run(['node', '-e', 'console.log(process.env.FOO)'], { env: { FOO: "1" } })

//   const stdout = await new Promise<string>((resolve, reject) => {
//     let output = ''
//     proc.stdout!.on('data', data => output += data)
//     proc.on('close', code => {
//       if (code !== 0) {
//         reject(code)
//       } else {
//         resolve(output)
//       }
//     })
//   })

//   assertEquals(stdout.trim(), "1")
// })
