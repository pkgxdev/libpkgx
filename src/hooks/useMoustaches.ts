import { Package, Installation } from "../types.ts"
import SemVer from "../utils/semver.ts"
import useConfig from "./useConfig.ts"
import useCellar from "./useCellar.ts"
import host from "../utils/host.ts"
import * as os from "node:os"

function tokenizePackage(pkg: Package) {
  return [{ from: "prefix", to: useCellar().keg(pkg).string }]
}

function tokenizeVersion(version: SemVer, prefix = 'version') {
  const rv = [
    { from:    prefix,             to: `${version}` },
    { from: `${prefix}.major`,     to: `${version.major}` },
    { from: `${prefix}.minor`,     to: `${version.minor}` },
    { from: `${prefix}.patch`,     to: `${version.patch}` },
    { from: `${prefix}.marketing`, to: `${version.major}.${version.minor}` },
    { from: `${prefix}.build`,     to: version.build.join('+') },
    { from: `${prefix}.raw`,       to: version.raw },
  ]
  if ('tag' in version) {
    rv.push({from: `${prefix}.tag`, to: (version as unknown as {tag: string}).tag})
  }
  return rv
}

//TODO replace `hw` with `host`
function tokenizeHost() {
  const { arch, target, platform } = host()
  return [
    { from: "hw.arch",        to: arch },
    { from: "hw.target",      to: target },
    { from: "hw.platform",    to: platform },
    { from: "hw.concurrency", to: os.cpus().length.toString() }
  ]
}

function apply(input: string, map: { from: string, to: string }[]) {
  return map.reduce((acc, {from, to}) =>
    acc.replace(new RegExp(`(^\\$)?{{\\s*${from}\\s*}}`, "g"), to),
    input)
}

export default function() {
  const config = useConfig()
  const base = {
    apply,
    tokenize: {
      version: tokenizeVersion,
      host: tokenizeHost,
      pkg: tokenizePackage
    }
  }

  const deps = (deps: Installation[]) => {
    const map: {from: string, to: string}[] = []
    for (const dep of deps ?? []) {
      map.push({ from: `deps.${dep.pkg.project}.prefix`, to: dep.path.string })
      map.push(...base.tokenize.version(dep.pkg.version, `deps.${dep.pkg.project}.version`))
    }
    return map
  }

  const pkgx = () => [{ from: "pkgx.prefix", to: config.prefix.string }]

  const all = (pkg: Package, deps_: Installation[]) => [
    ...deps(deps_),
    ...tokenizePackage(pkg),
    ...pkgx(),
    ...base.tokenize.version(pkg.version),
    ...base.tokenize.host(),
  ]

  return {
    apply: base.apply,
    tokenize: {
      ...base.tokenize,
      deps, pkgx, all
    }
  }
}
