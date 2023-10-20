import { deno, PlainObject } from "../deps.ts"
import { mkdtempSync } from "node:fs"
import * as sys from "node:path"
import * as os from "node:os"

const { io: { readLines }, fs, parseYaml, SEP } = deno

// modeled after https://github.com/mxcl/Path.swift

// everything is Sync because TypeScript will unfortunately not
// cascade `await`, meaning our chainable syntax would become:
//
//     await (await foo).bar
//
// however we use async versions for “terminators”, eg. `ls()`


//NOTE not considered good for general consumption on Windows at this time
// generally we try to workaround unix isms and there are some quirks


export default class Path {
  /// the normalized string representation of the underlying filesystem path
  readonly string: string

  /// the filesystem root
  static root = new Path("/")

  static cwd(): Path {
    return new Path(Deno.cwd())
  }

  static home(): Path {
    return new Path(
      (() => {
      switch (Deno.build.os) {
        case "windows":
          return Deno.env.get("USERPROFILE")!
        default:
          return Deno.env.get("HOME")!
      }
    })())
  }

  /// normalizes the path
  /// throws if not an absolute path
  constructor(input: string | Path) {
    if (input instanceof Path) {
      this.string = input.string
      return
    }

    if (!input) {
      throw new Error(`invalid absolute path: ${input}`)
    }

    if (Deno.build.os == 'windows') {
      if (!input.match(/^[a-zA-Z]:/)) {
        if (!input.startsWith("/") && !input.startsWith("\\")) {
          throw new Error(`invalid absolute path: ${input}`)
        }
        if (!input.startsWith('\\\\')) {
          // ^^ \\network\drive is valid path notation on windows

          //TODO shouldn’t be C: necessarily
          // should it be based on PWD or system default drive?
          // NOTE also: maybe we shouldn't do this anyway?
          input = `C:\\${input}`
        }
      }
      input = input.replace(/\//g, '\\')
    } else if (input[0] != '/') {
      throw new Error(`invalid absolute path: ${input}`)
    }

    this.string = normalize(input)

    function normalize(path: string): string {
      const segments = path.split(SEP)
      const result = []

      const start = Deno.build.os == 'windows' ? (segments.shift() || '\\') + '\\' : '/'

      for (const segment of segments) {
        if (segment === '..') {
          result.pop();
        } else if (segment !== '.' && segment !== '') {
          result.push(segment);
        }
      }

      return start + result.join(SEP);
    }
  }

  /// returns Path | undefined rather than throwing error if Path is not absolute
  static abs(input: string | Path) {
    try {
      return new Path(input)
    } catch {
      return
    }
  }

  /**
    If the path represents an actual entry that is a symlink, returns the symlink’s
    absolute destination.

    - Important: This is not exhaustive, the resulting path may still contain a symlink.
    - Important: The path will only be different if the last path component is a symlink, any symlinks in prior components are not resolved.
    - Note: If file exists but isn’t a symlink, returns `self`.
    - Note: If symlink destination does not exist, is **not** an error.
    */
  readlink(): Path {
    try {
      const output = Deno.readLinkSync(this.string)
      return this.parent().join(output)
    } catch (err) {
      const code = err.code
      switch (code) {
      case 'EINVAL':
        return this // is file
      case 'ENOENT':
        throw err   // there is no symlink at this path
      }
      throw err
    }
  }
  /**
    Returns the parent directory for this path.
    Path is not aware of the nature of the underlying file, but this is
    irrlevant since the operation is the same irrespective of this fact.
    - Note: always returns a valid path, `Path.root.parent` *is* `Path.root`.
    */
  parent(): Path {
    return new Path(sys.dirname(this.string))
  }

  /// returns normalized absolute path string
  toString(): string {
    return this.string
  }

  /// joins this path with the provided component and normalizes it
  /// if you provide an absolute path that path is returned
  /// rationale: usually if you are trying to join an absolute path it is a bug in your code
  /// TODO should warn tho
  join(...components: string[]): Path {
    const joined = components.filter(x => x).join(SEP)
    if (isAbsolute(joined)) {
      return new Path(joined)
    } else if (joined) {
      return new Path(`${this.string}${SEP}${joined}`)
    } else {
      return this
    }
    function isAbsolute(part: string) {
      if (Deno.build.os == 'windows' && (part?.match(/^[a-zA-Z]:/) || part?.startsWith("\\\\"))) {
        return true
      } else {
        return part.startsWith('/')
      }
    }
  }

  /// Returns true if the path represents an actual filesystem entry that is *not* a directory.
  /// NOTE we use `stat`, so if the file is a symlink it is resolved, usually this is what you want
  isFile(): Path | undefined {
    try {
      return Deno.statSync(this.string).isFile ? this : undefined
    } catch {
      return //FIXME
      // if (err instanceof Deno.errors.NotFound == false) {
      //   throw err
      // }
    }
  }

  isSymlink(): Path | undefined {
    try {
      return Deno.lstatSync(this.string).isSymlink ? this : undefined
    } catch {
      return //FIXME
      // if (err instanceof Deno.errors.NotFound) {
      //   return false
      // } else {
      //   throw err
      // }
    }
  }

  isExecutableFile(): Path | undefined {
    try {
      if (!this.isFile()) return
      const info = Deno.statSync(this.string)
      if (!info.mode) throw new Error()
      const is_exe = (info.mode & 0o111) > 0
      if (is_exe) return this
    } catch {
      return //FIXME catch specific errors
    }
  }

  isReadableFile(): Path | undefined {
    try {
      if (Deno.build.os != 'windows') {
        const {mode, isFile} = Deno.statSync(this.string)
        if (isFile && mode && mode & 0o400) {
          return this
        }
      } else {
        //FIXME not particularly efficient lol
        Deno.openSync(this.string, { read: true }).close();
        return this
      }
    } catch {
      return undefined
    }
  }

  exists(): Path | undefined {
    //FIXME can be more efficient
    try {
      Deno.statSync(this.string)
      return this
    } catch {
      return //FIXME
      // if (err instanceof Deno.errors.NotFound) {
      //   return false
      // } else {
      //   throw err
      // }
    }
  }

  /// Returns true if the path represents an actual directory.
  /// NOTE we use `stat`, so if the file is a symlink it is resolved, usually this is what you want
  isDirectory(): Path | undefined {
    try {
      return Deno.statSync(this.string).isDirectory ? this : undefined
    } catch {
      return //FIXME catch specific errorrs
    }
  }

  async *ls(): AsyncIterable<[Path, Deno.DirEntry]> {
    for await (const entry of Deno.readDir(this.string)) {
      yield [this.join(entry.name), entry]
    }
  }

  //FIXME probs can be infinite
  async *walk(): AsyncIterable<[Path, Deno.DirEntry]> {
    const stack: Path[] = [this]
    while (stack.length > 0) {
      const dir = stack.pop()!
      for await (const entry of Deno.readDir(dir.string)) {
        const path = dir.join(entry.name)
        yield [path, entry]
        if (entry.isDirectory) {
          stack.push(path)
        }
      }
    }
  }

  components(): string[] {
    return this.string.split(SEP)
  }

  static mktemp(opts?: { prefix?: string, dir?: Path }): Path {
    let {prefix, dir} = opts ?? {}
    dir ??= new Path(os.tmpdir())
    prefix ??= ""
    if (!prefix.startsWith('/')) prefix = `/${prefix}`
    // not using deno.makeTempDirSync because it's bugg’d and the node shim doesn’t handler `dir`
    const rv = mkdtempSync(`${dir.mkdir('p')}${prefix}`)
    return new Path(rv)
  }

  split(): [Path, string] {
    const d = this.parent()
    const b = this.basename()
    return [d, b]
  }

  /// the file extension with the leading period
  extname(): string {
    const match = this.string.match(/\.tar\.\w+$/)
    if (match) {
      return match[0]
    } else {
      return sys.extname(this.string)
    }
  }

  basename(): string {
    return sys.basename(this.string)
  }

  /**
    Moves a file.

        Path.root.join("bar").mv({to: Path.home.join("foo")})
        // => Path("/Users/mxcl/foo")

    - Parameter to: Destination filename.
    - Parameter into: Destination directory (you get `into/${this.basename()`)
    - Parameter overwrite: If true overwrites any entry that already exists at the destination.
    - Returns: `to` to allow chaining.
    - Note: `force` will still throw if `to` is a directory.
    - Note: Throws if `overwrite` is `false` yet `to` is *already* identical to
      `self` because even though *our policy* is to noop if the desired
      end result preexists, checking for this condition is too expensive a
      trade-off.
    */
  mv({force, ...opts}: {to: Path, force?: boolean} | {into: Path, force?: boolean}): Path {
    if ("to" in opts) {
      fs.moveSync(this.string, opts.to.string, { overwrite: force })
      return opts.to
    } else {
      const dst = opts.into.join(this.basename())
      fs.moveSync(this.string, dst.string, { overwrite: force })
      return dst
    }
  }

  //FIXME operates in ”force” mode
  //TODO needs a recursive option
  cp(opts: {into: Path} | {to: Path}): Path {
    const dst = 'into' in opts ? opts.into.join(this.basename()) : opts.to
    Deno.copyFileSync(this.string, dst.string)
    return dst
  }

  rm({recursive} = {recursive: false}) {
    if (this.exists()) {
      try {
        Deno.removeSync(this.string, { recursive })
      } catch (err) {
        if (this.exists()) {
          throw err
        } else {
          // this is what we wanted, so noop
        }
      }
    }
    return this  // may seem weird but I've had cases where I wanted to chain
  }

  mkdir(opts?: 'p'): Path {
    if (!this.isDirectory()) {
      Deno.mkdirSync(this.string, { recursive: opts == 'p' })
    }
    return this
  }

  isEmpty(): Path | undefined {
    for (const _ of Deno.readDirSync(this.string)) {
      return
    }
    return this
  }

  eq(that: Path): boolean {
    return this.string == that.string
  }

  neq(that: Path): boolean {
    return this.string != that.string
  }

  /// `this` is the symlink that is created pointing at `target`
  /// in Path.ts we always create `this`, our consistency helps with the notoriously difficuly argument order of `ln -s`
  /// note symlink is full and absolute path
  ln(_: 's', {target}: { target: Path }): Path {
    Deno.symlinkSync(target.string, this.string)
    return this
  }

  read(): Promise<string> {
    return Deno.readTextFile(this.string)
  }

  async *readLines(): AsyncIterableIterator<string> {
    const fd = Deno.openSync(this.string)
    try {
      for await (const line of readLines(fd))
        yield line
      }
    finally {
      fd.close()
    }
  }

  //FIXME like, we don’t want a hard dependency in the published library
  //TODO would be nice to validate the output against a type
  //TODO shouldn't be part of this module since we want to publish it
  async readYAML(): Promise<unknown> {
    try {
      const txt = await this.read()
      return parseYaml(txt, { filename: this.string /*improves err msgs*/ })
    } catch (err) {
      err.cause = this.string
      throw err
    }
  }

  readJSON(): Promise<unknown> {
    return this.read().then(x => JSON.parse(x))
  }

  write({ force, ...content }: ({text: string} | {json: PlainObject, space?: number}) & {force?: boolean}): Path {
    if (this.exists()) {
      if (!force) throw new Error(`file-exists:${this}`)
      this.rm()
    }
    if ("text" in content) {
      Deno.writeTextFileSync(this.string, content.text)
    } else {
      const text = JSON.stringify(content.json, null, content.space)
      Deno.writeTextFileSync(this.string, text)
    }
    return this
  }

  touch(): Path {
    //FIXME work more as expected
    return this.write({force: true, text: ""})
  }

  chmod(mode: number): Path {
    if (Deno.build.os != 'windows') {
      Deno.chmodSync(this.string, mode)
    }
    return this
  }

  chuzzle(): Path | undefined {
    if (this.exists()) return this
  }

  relative({ to: base }: { to: Path }): string {
    const pathComps = this.string.split(SEP)
    const baseComps = base.string.split(SEP)

    if (Deno.build.os == "windows") {
      if (pathComps[0] != baseComps[0]) {
        throw new Error("can't compute relative path between paths on different drives")
      }
    }

    pathComps[0] = SEP
    baseComps[0] = SEP

    if (this.string.startsWith(base.string)) {
      return pathComps.slice(baseComps.length).join(SEP)
    } else {
      const newPathComps = [...pathComps]
      const newBaseComps = [...baseComps]

      while (newPathComps[0] == newBaseComps[0]) {
        newPathComps.shift()
        newBaseComps.shift()
      }

      const relComps = Array.from({ length: newBaseComps.length } , () => "..")
      relComps.push(...newPathComps)
      return relComps.join(SEP)
    }
  }

  realpath(): Path {
    return new Path(Deno.realPathSync(this.string))
  }

  prettyString(): string {
    const home = Path.home().string
    if (this.string.startsWith(home)) {
      return '~' + this.string.slice(home.length)
    } else {
      return this.string
    }
  }

  // if we’re inside the CWD we print that
  prettyLocalString(): string {
    const cwd = Path.cwd()
    return this.string.startsWith(cwd.string) ? `./${this.relative({ to: cwd })}` : this.prettyString()
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.prettyString()
  }
}
