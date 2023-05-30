import { useTestConfig } from "../hooks/useTestConfig.ts"
import { assertEquals } from "deno/testing/asserts.ts"
import { exec, spawn } from "./run.ts"

Deno.test("porcelain.run", async () => {
  useTestConfig()
  const { stdout } = await exec(`python -c 'import os; print(os.environ.get("FOO"))'`, { env: { FOO: "1" } })
  assertEquals(stdout.trim(), "1")
})

Deno.test("porcelain.spawn", async () => {
  useTestConfig()
  const proc = await spawn('node', ['-e', 'console.log(process.env.FOO)'], { env: { FOO: "1" } })

  const stdout = await new Promise<string>((resolve, reject) => {
    let output = ''
    proc.stdout!.on('data', data => output += data)
    proc.on('close', code => {
      if (code !== 0) {
        reject(code)
      } else {
        resolve(output)
      }
    })
  })

  assertEquals(stdout.trim(), "1")
})
