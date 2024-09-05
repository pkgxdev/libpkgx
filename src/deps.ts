import * as is_what from "is-what"
export { is_what }

import { type PlainObject } from "is-what"
export type { PlainObject }

import * as outdent from "outdent"
export { outdent }

// importing super specifically to reduce final npm bundle size
import * as crypto from "deno/crypto/mod.ts"
import { moveSync } from "deno/fs/move.ts"
import { readLines } from "deno/io/read_lines.ts"
import { writeAll } from "deno/io/write_all.ts"
import { parse as parseYaml } from "deno/yaml/parse.ts"
import { SEPARATOR as SEP } from "deno/path/mod.ts"
import { fromFileUrl } from "deno/path/mod.ts"

const streams = { writeAll }
const io = { readLines }
const fs = { moveSync }
const deno = { readLines, crypto, fs, io, streams, parseYaml, SEP, fromFileUrl }

export { deno }
