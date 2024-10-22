import * as is_what from "is-what"
export { is_what }

import { type PlainObject } from "is-what"
export type { PlainObject }

import * as outdent from "outdent"
export { outdent }

// importing super specifically to reduce final npm bundle size
import * as crypto from "jsr:@std/crypto@1"
import { moveSync } from "jsr:@std/fs@1"
import { readLines } from "https://deno.land/std@0.224.0/io/read_lines.ts"
import { writeAll } from "jsr:@std/io@0.225.0"
import { parse as parseYaml } from "jsr:@std/yaml@1"
import { SEPARATOR as SEP, fromFileUrl } from "jsr:@std/path@1"

const streams = { writeAll }
const io = { readLines }
const fs = { moveSync }
const deno = { readLines, crypto, fs, io, streams, parseYaml, SEP, fromFileUrl }

export { deno }
