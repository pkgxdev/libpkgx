import { provides as cache_provides, available as cache_available } from "../hooks/useSyncCache.ts"
import usePantry, { PantryError } from "../hooks/usePantry.ts"
import { PackageRequirement } from "../types.ts"
import * as semver from "../utils/semver.ts"

export type WhichResult = PackageRequirement & {
  shebang: string[]
}

export default async function which(arg0: string, opts?: { providers?: boolean }): Promise<WhichResult | undefined>;
export default async function which(arg0: string, opts: { providers?: boolean, all: false }): Promise<WhichResult | undefined>;
export default async function which(arg0: string, opts: { providers?: boolean, all: true }): Promise<WhichResult[]>;
export default async function which(arg0: string, opts_?: { providers?: boolean, all?: boolean }) {

  const opts = { providers: opts_?.providers ?? true, all: opts_?.all ?? false }

  const rv: WhichResult[] = []
  for await (const result of _which(arg0, opts)) {
    if (opts.all) {
      rv.push(result)
    } else {
      return result
    }
  }
  if (!opts.all && rv.length == 0) {
    return
  } else {
    return rv
  }
}

async function *_which(arg0: string, opts: { providers: boolean }): AsyncGenerator<WhichResult> {
  arg0 = arg0.trim()
  /// sanitize and reject anything with path components
  if (!arg0 || arg0.includes("/")) return

  const pantry = usePantry()
  let found: WhichResult[] = []

  // don't use the cache if PKGX_PANTRY_PATH is set
  if (cache_available()) {
    const cached = await cache_provides(arg0)
    if (cached) {
      for (const project of cached) {
        yield { project, constraint: new semver.Range("*"), shebang: [arg0] }
      }
      // NOTE probs wrong, but we need a rewrite
      if (cached.length) return
    }
  }

  const promises: Promise<void>[] = []

  for await (const entry of pantry.ls()) {
    if (found.length) {
      for (const f of found) yield f
      found = []
    }
    const p = pantry.project(entry).provides().then(providers => {
      for (const provider of providers) {
        if (provider == arg0) {
          const constraint = new semver.Range("*")
          found.push({...entry, constraint, shebang: [provider] })
        } else if (arg0.startsWith(provider)) {
          // eg. `node^16` symlink
          try {
            const constraint = new semver.Range(arg0.substring(provider.length))
            found.push({...entry, constraint, shebang: [provider] })
          } catch {
            // not a valid semver range; fallthrough
          }
        } else {
          //TODO more efficient to check the prefix fits arg0 first
          // eg. if python3 then check if the provides starts with python before
          // doing all the regex shit. Matters because there's a *lot* of YAMLs

          let rx = /({{\s*version\.(marketing|major)\s*}})/
          let match = provider.match(rx)
          if (!match?.index) continue
          const regx = match[2] == 'major' ? '\\d+' : '\\d+\\.\\d+'
          const foo = subst(match.index, match.index + match[1].length, provider, `(${regx})`)
          rx = new RegExp(`^${foo}$`)
          match = arg0.match(rx)
          if (match) {
            const constraint = new semver.Range(`~${match[1]}`)
            found.push({...entry, constraint, shebang: [arg0] })
          }
        }
      }
    }).swallow(PantryError)

    promises.push(p)

    if (opts.providers) {
      const pp = pantry.project(entry).provider().then(f => {
        if (!f) return
        const rv = f(arg0)
        if (rv) found.push({
          ...entry,
          constraint: new semver.Range('*'),
          shebang: [...rv, arg0]
        })
      })
      promises.push(pp)
    }
  }

  await Promise.all(promises)

  // if we didn’t find anything yet then we have to wait on the promises
  // otherwise we can ignore them

  for (const f of found) {
    yield f
  }
}

const subst = function(start: number, end: number, input: string, what: string) {
  return input.substring(0, start) + what + input.substring(end)
}
