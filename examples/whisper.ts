#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env --unstable --allow-net

import { porcelain } from "https://raw.github.com/teaxyz/lib/v0/mod.ts"
const { run } = porcelain

const url = 'https://raw.githubusercontent.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav'
const rsp = await fetch(url)
await Deno.writeFile("jfk.wav", rsp.body!)

await run("whisper.cpp jfk.wav")
