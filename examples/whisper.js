/*
    npm install libpkgx
    node whisper.js
*/

const { porcelain } = require("libpkgx")
const https = require("node:https")
const { run } = porcelain
const fs = require("node:fs")

const url = 'https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav'

const fetch = new Promise(done =>
  https.get(url, rsp =>
    rsp.pipe(fs.createWriteStream("jfk.wav")).on('finish', done)))

fetch.then(() =>run("whisper.cpp jfk.wav"))
