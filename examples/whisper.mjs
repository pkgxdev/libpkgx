/*
    npm install @teaxyz/lib
    node whisper.mjs
*/

import { porcelain } from "@teaxyz/lib"
import https from "node:https"
const { run } = porcelain
import fs from "node:fs"

const url = 'https://raw.githubusercontent.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav'

await new Promise(done =>
  https.get(url, rsp =>
    rsp.pipe(fs.createWriteStream("jfk.wav")).on('finish', done)))

await run("whisper.cpp jfk.wav")
