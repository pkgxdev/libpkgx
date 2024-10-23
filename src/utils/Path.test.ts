import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert"
import { SEPARATOR as SEP } from "jsr:@std/path@1"
import Path from "./Path.ts"

Deno.test("test Path", async test => {
  await test.step("creating files", () => {
    const start = Deno.build.os == 'windows' ? 'C:' : ''
    assertEquals(new Path("/a/b/c").components(), [start, "a", "b", "c"])
    assertEquals(new Path("/a/b/c").split(), [new Path("/a/b"), "c"])

    const tmp = Path.mktemp({prefix: "pkgx-"})
    assert(tmp.isEmpty())

    const child = tmp.join("a/b/c")
    assertFalse(child.parent().isDirectory())
    child.parent().mkdir('p')
    assert(child.parent().isDirectory())

    assertThrows(() => child.readlink()) // not found
    assertFalse(child.isReadableFile())
    child.touch()
    assert(child.isReadableFile())

    assert(child.string.startsWith(tmp.string))
    assertFalse(tmp.isEmpty())
    if (Deno.build.os != 'windows') {
      assertEquals(child.readlink(), child) // not a link
    }

    const rs = Deno.build.os === "windows" ? "C:\\" : '/'
    assertEquals(new Path("/").string, rs)
  })

  await test.step("write and read", async () => {
    const tmp = Path.mktemp({prefix: "pkgx-"})

    const data = tmp.join("test.dat")
    data.write({text: "hello\nworld"})

    const lines = await asyncIterToArray(data.readLines())
    assertEquals(lines, ["hello", "world"])

    // will throw with no force flag
    assertThrows(() => data.write({ json: { hello: "world" } }))

    data.write({ json: { hello: "world" }, force: true })
    assertEquals(await data.readJSON(), { hello: "world" })
  })

  await test.step("test walk", async () => {
    const tmp = Path.mktemp({prefix: "pkgx-"})

    const a = tmp.join("a").mkdir()
    a.join("a1").touch()
    a.join("a2").touch()

    const b = tmp.join("b").mkdir()
    b.join("b1").touch()
    b.join("b2").touch()

    const c = tmp.join("c").mkdir()
    c.join("c1").touch()
    c.join("c2").touch()

    assert(c.join("c2").isFile())
    assert(c.isDirectory())

    const walked = (await asyncIterToArray(tmp.walk()))
      .map(([path, entry]) => {
        return {name: path.basename(), isDir: entry.isDirectory}
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    assertEquals(walked, [
      { name: "a", isDir: true},
      { name: "a1", isDir: false},
      { name: "a2", isDir: false},
      { name: "b", isDir: true},
      { name: "b1", isDir: false},
      { name: "b2", isDir: false},
      { name: "c", isDir: true},
      { name: "c1", isDir: false},
      { name: "c2", isDir: false},
    ])
  })

  await test.step({
    name: "test symlink created",
    ignore: Deno.build.os == "windows",
    fn() {
      const tmp = Path.mktemp({prefix: "pkgx-"}).join("foo").mkdir()
      const a = tmp.join("a").touch()
      const b = tmp.join("b")
      b.ln('s', { target: a })
      assertEquals(b.readlink(), a)
      assert(b.isSymlink())
    }
  })
})

Deno.test("Path.cwd", () => {
  const cwd = Path.cwd()
  assertEquals(cwd.string, Deno.cwd())
})

Deno.test("normalization", () => {
  const start = Deno.build.os == 'windows' ? 'C:\\' : SEP
  assertEquals(new Path("/a/b/").string, `${start}a${SEP}b`)
  assertEquals(new Path("/a/b////").string, `${start}a${SEP}b`)
  assertEquals(new Path("/a/b").string, `${start}a${SEP}b`)
  assertEquals(new Path("/a////b").string, `${start}a${SEP}b`)
})

Deno.test("new Path(Path)", () => {
  const p1 = new Path("/home/user/file.txt")
  const p2 = new Path(p1)
  assertEquals(p1, p2)
})

Deno.test("Path.join()", () => {
  const path = new Path("/foo")
  assert(path.eq(path.join()))
})

Deno.test({
  name: "Path.isExecutableFile()",
  ignore: Deno.build.os == "windows",
  fn() {
    const tmp = Path.mktemp({prefix: "pkgx-"}).mkdir()
    const executable = tmp.join("executable").touch()
    executable.chmod(0o755)
    const notExecutable = tmp.join("not-executable").touch()

    assert(executable.isExecutableFile())
    assertFalse(notExecutable.isExecutableFile())
  }
})

Deno.test("Path.extname()", () => {
  const path = new Path("/home/user/file.txt")
  assertEquals(path.extname(), ".txt")
})

Deno.test("Path.mv()", () => {
  const tmp = Path.mktemp({prefix: "pkgx-"})
  const a = tmp.join("a").touch()
  const b = tmp.join("b")

  a.mv({ to: b })
  assertFalse(a.exists())
  assert(b.exists())

  const c = tmp.join("c").mkdir()
  b.mv({ into: c })

  assertFalse(b.exists())
  assert(c.join("b").exists())

  assertThrows(() => c.mv({ to: c }))

  // for coverage
  assert(b.neq(c))
})

Deno.test("Path.cp()", () => {
  const tmp = Path.mktemp({prefix: "pkgx-"}).mkdir()
  const a = tmp.join("a").touch()
  const b = tmp.join("b").mkdir()

  a.cp({ into: b })
  assert(b.join("a").isReadableFile())
  assert(a.isReadableFile())
})

Deno.test("Path.relative()", () => {
  const a = new Path("/home/user/file.txt")
  const b = new Path("/home/user/dir")
  assertEquals(a.relative({ to: b }), `..${SEP}file.txt`)
  assertEquals(b.relative({ to: a }), `..${SEP}dir`)
})

Deno.test({
  name: "Path.realpath()",
  ignore: Deno.build.os == "windows",
  fn() {
    const tmp = Path.mktemp({prefix: "pkgx-"}).mkdir()
    const a = tmp.join("a").touch()
    const b = tmp.join("b").ln('s', { target: a })

    assertEquals(b.realpath(), a.realpath())
  }
})

Deno.test("Path.prettyLocalString()", () => {
  const path = Path.home().join(".config/pkgx/config.toml")
  assertEquals(path.prettyLocalString(), `~${SEP}.config${SEP}pkgx${SEP}config.toml`)

  const root = Deno.build.os == 'windows' ? 'C:\\' : '/'
  assertEquals(new Path("/a/b").prettyLocalString(), `${root}a${SEP}b`)
})

Deno.test("Path.chuzzle()", () => {
  const path = Path.mktemp().join("file.txt").touch()
  assertEquals(path.chuzzle(), path)

  const missingPath = path.parent().join("ghost.void")
  assertEquals(missingPath.chuzzle(), undefined)
})

Deno.test("Path.ls()", async () => {
  const tmp = Path.mktemp({prefix: "pkgx-"}).mkdir()
  tmp.join("a").touch()
  tmp.join("b").touch()
  tmp.join("c").mkdir()

  const entries = (await asyncIterToArray(tmp.ls())).map(([,{name}]) => name)
  assertEquals(entries.sort(), ["a", "b", "c"])
})

async function asyncIterToArray<T> (iter: AsyncIterable<T>){
  const result = [];
  for await(const i of iter) {
    result.push(i);
  }
  return result;
}

Deno.test("ctor throws", () => {
  assertThrows(() => new Path(""))
  assertThrows(() => new Path("   "))
  assertThrows(() => new Path("   \n    "))
  assertThrows(() => new Path("    /   "))
})

Deno.test({
  name: "dirname",
  ignore: Deno.build.os != "windows",
  fn() {
    const p = new Path("Y:\\")
    assertEquals(p.string, "Y:\\")
    assertEquals(p.parent().string, "Y:\\")
    assertEquals(p.parent().parent().parent().string, "Y:\\")

    const q = new Path("\\\\bar\\foo\\baz")

    assertEquals(q.string, "\\\\bar\\foo\\baz")
    assertEquals(q.parent().string, "\\\\bar\\foo")
    assertEquals(q.parent().parent().parent().string, "\\\\bar\\foo")  // the first path after the hostname is actually a root
  }
})

Deno.test("join roots", () => {
  if (Deno.build.os == "windows") {
    assertEquals(new Path("C:\\foo").join("D:\\bar").string, "D:\\bar")
    assertEquals(new Path("C:").join("D:\\bar\baz").string, "D:\\bar\baz")

    assertEquals(new Path("c:\\foo\bar").join("\\\\bar\\baz").string, "\\\\bar\\baz")

  } else {
    assertEquals(new Path("/foo").join("/bar").string, "/bar")
  }
})
