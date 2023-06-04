import * as is_what from "https://deno.land/x/is_what@v4.1.13/src/index.ts"
export { is_what }

import { type PlainObject } from "https://deno.land/x/is_what@v4.1.13/src/index.ts"
export type { PlainObject }

import * as outdent from "https://deno.land/x/outdent@v0.8.0/mod.ts"
export { outdent }

// importing super specifically to reduce final npm bundle size
import * as crypto from "https://deno.land/std@0.190.0/crypto/mod.ts"
import { moveSync } from "https://deno.land/std@0.190.0/fs/move.ts"
import { readLines } from "https://deno.land/std@0.190.0/io/read_lines.ts"
import { writeAll } from "https://deno.land/std@0.190.0/streams/write_all.ts"
import { parse as parseYaml } from "https://deno.land/std@0.190.0/yaml/parse.ts"

const streams = { writeAll }
const io = { readLines }
const fs = { moveSync }
const deno = { readLines, crypto, fs, io, streams, parseYaml }

export { deno }
