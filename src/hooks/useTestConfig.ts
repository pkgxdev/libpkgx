import useConfig, { ConfigDefault } from "./useConfig.ts"
import { fromFileUrl } from "jsr:@std/path@1"
import Path from "../utils/Path.ts"

export function useBaseTestConfig(env?: Record<string, string>) {
  env ??= {}

  /// always prefer a new prefix
  env.PKGX_HOME ??= Path.mktemp().string

  const config = ConfigDefault(env)
  if ('UserAgent' in env) {
    config.UserAgent = env['UserAgent']
  }

  return useConfig(config)
}

import usePantry from "./usePantry.ts"

export function useTestConfig(env?: Record<string, string>) {
  const conf = useBaseTestConfig(env)
  copyDirectory(srcroot.join("fixtures/projects").string, usePantry().prefix.mkdir('p').string)
  return conf
}

export const srcroot = (() => {
  // because when running via dnt the path of this file is different
  if (Path.cwd().parent().parent().join("fixtures").isDirectory()) {
    return Path.cwd().parent().parent()
  } else {
    return new Path(fromFileUrl(import.meta.url)).parent().parent().parent()
  }
})()

import { walkSync } from 'jsr:@std/fs@1'

// deno/dnt has a broken shim for this function
function copyDirectory(src: string, dest: string) {
  for (const entry of walkSync(src)) {
    const destPath = entry.path.replace(src, dest);

    if (entry.isDirectory) {
      Deno.mkdirSync(destPath, { recursive: true });
    } else {
      Deno.copyFileSync(entry.path, destPath);
    }
  }
}
