#!/usr/bin/env -S pkgx deno run --allow-read --allow-write --allow-run --allow-env --unstable --allow-net

/*
  sh <(curl pkgx.sh) deno https://raw.githubusercontent.com/pkgxdev/lib/main/examples/whisper.ts
*/

import { porcelain } from "https://raw.github.com/pkgxdev/lib/v0/mod.ts"
import { green } from "https://deno.land/std/fmt/colors.ts"
const { run } = porcelain

const url = 'https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav'
const rsp = await fetch(url)
await Deno.writeFile("jfk.wav", rsp.body!)

await run("whisper.cpp jfk.wav --output-json")

const txt = Deno.readTextFileSync("jfk.wav.json")
const json = JSON.parse(txt)

console.log()
console.log(green(json.transcription[0].text.trim()))
