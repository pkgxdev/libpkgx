import { PackageRequirement } from "../types.ts"
import usePantry from "../hooks/usePantry.ts"
import * as semver from "../utils/semver.ts"

export type WhichResult = PackageRequirement & {
  shebang: string[]
}

export default async function(arg0: string, opts = { providers: true }): Promise<WhichResult | undefined> {
  arg0 = arg0.trim()
  /// sanitize and reject anything with path components
  if (!arg0 || arg0.includes("/")) return

  const pantry = usePantry()
  let found: { project: string, constraint: semver.Range, shebang: string[] } | undefined
  const promises: Promise<void>[] = []

  for await (const entry of pantry.ls()) {
    if (found) break
    const p = pantry.project(entry).provides().then(providers => {
      for (const provider of providers) {
        if (found) {
          return
        } else if (provider == arg0) {
          const constraint = new semver.Range("*")
          found = {...entry, constraint, shebang: [provider] }
        } else if (arg0.startsWith(provider)) {
          // eg. `node^16` symlink
          try {
            const constraint = new semver.Range(arg0.substring(provider.length))
            found = {...entry, constraint, shebang: [provider] }
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
            found = {...entry, constraint, shebang: [arg0] }
          }
        }
      }
    }).swallow(/^parser: pantry: package.yml/)
    promises.push(p)

    if (opts.providers) {
      const pp = pantry.project(entry).provider().then(f => {
        if (!f) return
        const rv = f(arg0)
        if (rv) found = {
          ...entry,
          constraint: new semver.Range('*'),
          shebang: [...rv, arg0]
        }
      })
      promises.push(pp)
    }
  }

  if (!found) {
    // if we didn’t find anything yet then we have to wait on the promises
    // otherwise we can ignore them
    await Promise.all(promises)
  }

  if (found) {
    return found
  }
}

const subst = function(start: number, end: number, input: string, what: string) {
  return input.substring(0, start) + what + input.substring(end)
}
