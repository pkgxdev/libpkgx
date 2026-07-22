import * as is_what from "is-what"
export { is_what }

import type { PlainObject } from "is-what"
export type { PlainObject }

import * as outdent from "outdent"
export { outdent }

// importing super specifically to reduce final npm bundle size
import * as crypto from "@std/crypto"
import { moveSync } from "@std/fs"
import { writeAll } from "@std/io/write-all"
import { parse as parseYaml, parseAll as parseYamlALL } from "@std/yaml"
import { SEPARATOR as SEP, fromFileUrl } from "@std/path"

const streams = { writeAll }
const fs = { moveSync }
const deno = { crypto, fs, streams, parseYaml, parseYamlALL, SEP, fromFileUrl }

export { deno }
