import useLogger, { Logger, teal, gray, logJSON } from "./useLogger.ts"
import { crypto, toHashString } from "deno/crypto/mod.ts"
import TeaError, { panic } from "../utils/error.ts"
import { Verbosity } from "../types.ts"
import useConfig from "./useConfig.ts"
import useFetch from "./useFetch.ts"
import { isString } from "is-what"
import Path from "../utils/Path.ts"

interface DownloadOptions {
  src: URL
  headers?: Record<string, string>
  logger?: Logger | string
  dst?: Path
}

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}

async function internal<T>({ src, headers, logger, dst }: DownloadOptions): Promise<[Path, ReadableStream<Uint8Array> | undefined]>
{
  const { options: { suppress_download_progress_output }, modifiers: { verbosity, json } } = useConfig()
  const silent = verbosity <= Verbosity.quiet
  logger = isString(logger) ? useLogger().new(logger) : logger ?? useLogger().new()

  const hash = hash_key(src)
  const mtime_entry = hash.join("mtime")
  const etag_entry = hash.join("etag")

  dst ??= hash.join(new Path(src.pathname).basename())
  if (src.protocol === "file:") throw new Error()

  console.log({src: src, dst})

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
  } else if (!json) {
    logger.replace(teal('downloading'))
  }

  const rsp = await useFetch(src, { headers })

  switch (rsp.status) {
  case 200: {
    const sz = parseInt(rsp.headers.get("Content-Length")!).chuzzle()

    let txt = teal('downloading')
    if (sz) txt += ` ${gray(pretty_size(sz))}`
    if (!json) {
      logger.replace(txt)
    } else {
      logJSON({status: "downloading"})
    }

    const reader = rsp.body ?? panic()

    const text = rsp.headers.get("Last-Modified")
    if (text) mtime_entry.write({text, force: true})
    const etag = rsp.headers.get("ETag")
    if (etag) etag_entry.write({text: etag, force: true})

    if (silent || suppress_download_progress_output) {
      return [dst, reader]
    } else {
      let n = 0
      return [dst, reader.pipeThrough(new TransformStream({
        transform: (buf, controller) => {
          n += buf.length
          if (json) {
            logJSON({status: "downloading", "received": n, "content-size": sz })
          } else if (!sz) {
            (logger as Logger).replace(`${txt} ${pretty_size(n)}`)
          } else {
            let s = txt
            if (n < sz) {
              let pc = n / sz * 100;
              pc = pc < 1 ? Math.round(pc) : Math.floor(pc);  // don’t say 100% at 99.5%
              s += ` ${pc}%`
            } else {
              s = teal('extracting')
            }
            (logger as Logger).replace(s)
          }
          controller.enqueue(buf)
      }}))]
    }
  }
  case 304:
    if (json) {
      logJSON({status: "downloaded"})
    } else {
      logger.replace(`cache: ${teal('hit')}`)
    }
    return [dst, undefined]
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

async function stream<T>(opts: DownloadOptions): Promise<AsyncIterableIterator<Uint8Array> | undefined> {
  try {
    const [, stream] = await internal(opts)
    return stream?.[Symbol.asyncIterator]()
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

function pretty_size(n: number) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"]
  let i = 0
  while (n > 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  const precision = n < 10 ? 2 : n < 100 ? 1 : 0
  return `${n.toFixed(precision)} ${units[i]}`
}
