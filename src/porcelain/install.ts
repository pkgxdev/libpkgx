import install, { Logger as BaseLogger, ConsoleLogger as BaseConsoleLogger } from "../plumbing/install.ts"
import { Installation, PackageSpecification } from "../types.ts"
import resolve, { Resolution } from "../plumbing/resolve.ts"
import usePantry from "../hooks/usePantry.ts"
import hydrate from "../plumbing/hydrate.ts"
import useSync from "../hooks/useSync.ts"
import { parse } from "../utils/pkg.ts"
import link from "../plumbing/link.ts"
import { is_what } from "../deps.ts"
const { isString } = is_what

export interface Logger extends BaseLogger {
  resolved?(resolution: Resolution): void
  /// from 0.0–1.0
  /// currently you won’t get this immediately since we are waiting for all our
  /// network requests to return before we know the final download size
  progress?(completion: number): void
}

// deno-lint-ignore no-explicit-any
export function ConsoleLogger(prefix?: any): Logger {
  prefix = prefix ? `${prefix}: ` : ""
  return {
    ...BaseConsoleLogger(prefix),
    progress: function() { console.error(`${prefix}progress`, ...arguments) },
  }
}

/// eg. install("python.org~3.10")
export default async function(pkgs: PackageSpecification[] | string[] | string, logger?: Logger): Promise<Installation[]> {

  const { hydrate, resolve, install, link, useSync } = _internals

  if (isString(pkgs)) pkgs = pkgs.split(/\s+/)
  pkgs = pkgs.map(pkg => isString(pkg) ? parse(pkg) : pkg)

  const pantry = usePantry()

  if (pantry.missing() || pantry.neglected()) {
    await useSync()
  }

  //TODO parallelize!

  pkgs = (await hydrate(pkgs)).pkgs
  const resolution = await resolve(pkgs)
  logger?.resolved?.(resolution)

  const { pending, installed } = resolution
  logger = WrapperLogger(pending, logger)
  const installers = pending
    .map(pkg => install(pkg, logger)
      .then(i => Deno.build.os != 'windows'
        ? link(i).then(() => i)
        : i))

  installed.push(...await Promise.all(installers))

  return installed
}

function WrapperLogger(pending: PackageSpecification[], logger?: Logger): Logger | undefined {
  if (!logger?.progress) return logger

  const projects = pending.map(pkg => pkg.project)
  const totals: Record<string, number> = {}
  const progresses: Record<string, number> = {}
  return {
    ...logger,
    downloading: args => {
      const { pkg: {project}, total } = args
      if (total) {
        totals[project] = total
        updateProgress()
      }
      if (logger?.downloading) {
        logger.downloading(args)
      }
    },
    installing: args => {
      const { pkg: {project}, progress } = args
      if (progress) {
        progresses[project] = progress
        updateProgress()
      }
      if (logger?.installing) {
        logger.installing(args)
      }
    }
  }

  function updateProgress() {
    let total_untard_bytes = 0
    let grand_total = 0
    for (const project of projects) {
      const total = totals[project]
      const bytes = progresses[project] * total
      total_untard_bytes += bytes
      grand_total += total
    }
    const rv = total_untard_bytes / grand_total
    if (!isNaN(rv)) {
      logger!.progress!(total_untard_bytes / grand_total)
    }
  }
}

export const _internals = {
  hydrate,
  resolve,
  install,
  link,
  useSync
}