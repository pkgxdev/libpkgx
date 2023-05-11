import { flatmap } from "../utils/misc.ts"
import { Verbosity } from "../types.ts"
import host from "../utils/host.ts"
import Path from "../utils/Path.ts"
import { isNumber } from "is-what"

export interface Config {
  prefix: Path
  pantries: Path[]

  options: {
    /// prefer xz or gz for bottle downloads
    compression: 'xz' | 'gz'
    suppress_download_progress_output: boolean
  }

  UserAgent?: string

  logger: {
    prefix?: string
    color: boolean
  }

  modifiers: {
    dryrun: boolean
    verbosity: Verbosity
    json: boolean
  }
}

export function ConfigDefault(env = Deno.env.toObject()): Config {
  const prefix = Path.abs(env['TEA_PREFIX']) ?? Path.home().join('.tea')
  const pantries = env['TEA_PANTRY_PATH']?.split(":").map(x => Path.cwd().join(x)) ?? []
  const isCI = boolize(env['CI']) ?? false
  const compression = !isCI && host().platform == 'darwin' ? 'xz' : 'gz'
  return {
    prefix,
    pantries,
    UserAgent: `tea.lib/0.1.0`, //FIXME version
    logger: {
      prefix: "tea:",
      color: loggerColor(),
    },
    options: {
      compression,
      suppress_download_progress_output: isCI
    },
    modifiers: {
      dryrun: false,
      verbosity: getVerbosity(),
      json: false
    }
  }

  function loggerColor() {
    const isTTY = () => Deno.isatty(Deno.stdout.rid) && Deno.isatty(Deno.stdout.rid)

    if ((env.CLICOLOR ?? '1') != '0' && isTTY()){
      //https://bixense.com/clicolors/
      return true
    }
    if ((env.CLICOLOR_FORCE ?? '0') != '0') {
      //https://bixense.com/clicolors/
      return true
    }
    if ((env.NO_COLOR ?? '0') != '0') {
      return false
    }
    if (env.CLICOLOR == '0' || env.CLICOLOR_FORCE == '0') {
      return false
    }
    if (env.CI) {
      // this is what charm’s lipgloss does, we copy their lead
      // however surely nobody wants `tea foo > bar` to contain color codes?
      // the thing is otherwise we have no color in CI since it is not a TTY
      return true
    }

    return false
  }

  function getVerbosity() {
    const { DEBUG, GITHUB_ACTIONS, RUNNER_DEBUG, VERBOSE } = env

    if (DEBUG == '1') return Verbosity.debug
    if (GITHUB_ACTIONS == 'true' && RUNNER_DEBUG  == '1') return Verbosity.debug

    const verbosity = flatmap(VERBOSE, parseInt)
    return isNumber(verbosity) ? verbosity : Verbosity.normal
  }
}

export default function useConfig(input?: Config): Config {
  if (!config || input) {
    config = input ?? ConfigDefault()
  }
  return config
}

let config: Config | undefined

function boolize(input: string | undefined): boolean | undefined {
  switch (input?.trim()?.toLowerCase()) {
    case '0':
    case 'false':
    case 'no':
      return false
    case '1':
    case 'true':
    case 'yes':
      return true
  }
}

function reset() {
  return config = undefined
}

function initialized() {
  return config !== undefined
}

export const _internals = { reset, initialized }
