import { deno } from "../deps.ts"
const { crypto: crypto_, streams: { writeAll } } = deno
const { toHashString, crypto } = crypto_
import { TeaError, panic } from "../utils/error.ts"
import useConfig from "./useConfig.ts"
import useFetch from "./useFetch.ts"
import Path from "../utils/Path.ts"
import * as fs from "node:fs"
import "../utils/misc.ts"

interface DownloadOptions {
  src: URL
  dst?: Path
  headers?: Record<string, string>
  logger?: (info: {src: URL, dst: Path, rcvd?: number, total?: number }) => void
}

export class DownloadError extends TeaError {
  status: number
  src: URL
  headers?: Record<string, string>

  constructor(status: number, opts: { src: URL, headers?: Record<string, string>}) {
    super(`http: ${status}: ${opts.src}`)
    this.name = 'DownloadError'
    this.status = status
    this.src = opts.src
    this.headers = opts.headers
  }
}

const tmpname = (dst: Path) => dst.parent().join(dst.basename() + ".incomplete")

async function download(opts: DownloadOptions, chunk?: (blob: Uint8Array) => Promise<void>): Promise<Path> {
  const [dst, stream] = await the_meat(opts)

  if (stream || chunk) {
    const reader = stream ?? fs.createReadStream(dst.string)

    const writer = await (() => {
      if (stream) {
        dst.parent().mkdir('p')
        return Deno.open(tmpname(dst).string, {write: true, create: true, truncate: true})
      }
    })()

    for await (const blob of reader) {
      const pp: Promise<void>[] = []
      if (writer) pp.push(writeAll(writer, blob))
      if (chunk) pp.push(chunk(blob))
      await Promise.all(pp)
    }

    if (reader instanceof fs.ReadStream) {
      reader.close()
    }
    if (writer) {
      writer.close()
      tmpname(dst).mv({ to: dst, force: true })
    }
  }

  return dst
}

function cache({ for: url }: {for: URL}): Path {
  return useConfig().cache
    .join(url.protocol.slice(0, -1))
    .join(url.hostname)
    .join(hash())
    .mkdir('p')

  function hash() {
    let key = url.pathname
    if (url.search) key += `?${url.search}`
    const blob = new TextEncoder().encode(key)
    const hash = crypto.subtle.digestSync("SHA-256", blob)
    return toHashString(hash)
  }
}

export default function useDownload() {
  return {
    download,
    cache
  }
}


/// internal

async function the_meat<T>({ src, logger, headers, dst }: DownloadOptions): Promise<[Path, ReadableStream<Uint8Array> | undefined, number | undefined]>
{
  const hash = cache({ for: src })
  const mtime_entry = hash.join("mtime")
  const etag_entry = hash.join("etag")

  dst ??= hash.join(new Path(src.pathname).basename())

  if (logger) logger({ src, dst })

  if (dst.isReadableFile()) {
    headers ??= {}
    if (etag_entry.isFile()) {
      headers["If-None-Match"] = await etag_entry.read()
    }
    // sending both if we have them is ChatGPT recommended
    // also this fixes getting the mysql.com sources, otherwise it redownloads 400MB every time!
    if (mtime_entry.isFile()) {
      headers["If-Modified-Since"] = await mtime_entry.read()
    }
  }

  if (logger) logger({ src, dst })

  const rsp = await useFetch(src, { headers })

  switch (rsp.status) {
  case 200: {
    const sz = parseInt(rsp.headers.get("Content-Length")!).chuzzle()

    if (logger) logger({ src, dst, total: sz })

    const reader = rsp.body ?? panic()

    const text = rsp.headers.get("Last-Modified")
    if (text) mtime_entry.write({text, force: true})
    const etag = rsp.headers.get("ETag")
    if (etag) etag_entry.write({text: etag, force: true})

    if (!logger) {
      return [dst, reader, sz]
    } else {
      let n = 0
      return [dst, reader.pipeThrough(new TransformStream({
        transform: (buf, controller) => {
          n += buf.length
          logger({ src, dst: dst!, rcvd: n, total: sz })
          controller.enqueue(buf)
      }})), sz]
    }
  }
  case 304: {
    const sz = (await Deno.stat(dst.string)).size
    if (logger) logger({ src, dst, rcvd: sz, total: sz })
    return [dst, undefined, sz]
  }
  default:
    throw new DownloadError(rsp.status, { src, headers })
  }
}
