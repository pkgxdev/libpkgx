// the sqlite lib we use only works in deno

import { PackageRequirement } from "../../mod.ts";

export default async function()
{}

export function provides(_program: string): string[] {
  throw new Error()
}

export function dependencies(_project: string): PackageRequirement[] {
  throw new Error()
}

export function completion(_prefix: string): string[] {
  throw new Error()
}

/// is the cache available?
export function available(): boolean {
  return false
}

export function companions(_project: string): PackageRequirement[] {
  throw new Error()
}

export function runtime_env(_project: string): Record<string, string> {
  throw new Error()
}
