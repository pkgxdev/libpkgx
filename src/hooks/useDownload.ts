import { crypto, toHashString } from "deno/crypto/mod.ts"
import TeaError, { panic } from "../utils/error.ts"
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

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}


async function internal<T>({ src, headers, logger, dst }: DownloadOptions): Promise<[Path, ReadableStream<Uint8Array> | undefined, number | undefined]>
{
  const hash = hash_key(src)
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
    throw new Error(`${rsp.status}: ${src}`)
  }
}

async function download(opts: DownloadOptions): Promise<Path> {
  try {
    const [path, stream] = await internal(opts)
    if (!stream) return path  // already downloaded

    path.parent().mkpath()

    const f = await Deno.open(path.string, {write: true, create: true, truncate: true})

    for await (const blob of stream) {
      await f.write(blob)
    }

    f.close()

    return path
  } catch (cause) {
    throw new TeaError('http', {cause, ...opts})
  }
}

/// the `number` is the server reported file size
async function stream<T>(opts: DownloadOptions): Promise<[AsyncIterableIterator<Uint8Array>, number | undefined, 'network' | Path]> {
  try {
    const [dst, stream, sz] = await internal(opts)
    if (stream) {
      return [stream[Symbol.asyncIterator](), sz, 'network']
    } else {
      const stream = fs.createReadStream(dst.string)[Symbol.asyncIterator]()
      return [stream, sz, dst]
    }
  } catch (cause) {
    throw new TeaError('http', {cause, ...opts})
  }
}

function hash_key(url: URL): Path {
  function hash(url: URL) {
    const formatted = `${url.pathname}${url.search ? "?" + url.search : ""}`
    const contents = new TextEncoder().encode(formatted)
    return toHashString(crypto.subtle.digestSync("SHA-256", contents))
  }

  const prefix = useConfig().prefix.join("tea.xyz/var/www")

  return prefix
    .join(url.protocol.slice(0, -1))
    .join(url.hostname)
    .join(hash(url))
    .mkpath()
}

export default function useDownload() {
  return {
    download,
    stream,
    hash_key
  }
}
