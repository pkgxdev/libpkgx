import { assert, assertEquals, assertFalse, assertThrows } from "deno/testing/asserts.ts"
import Path from "./Path.ts"

Deno.test("test Path", async test => {
  await test.step("creating files", () => {
    assertEquals(new Path("/a/b/c").components(), ["", "a", "b", "c"])
    assertEquals(new Path("/a/b/c").split(), [new Path("/a/b"), "c"])

    const tmp = Path.mktemp({prefix: "tea-"})
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
    assertEquals(child.readlink(), child) // not a link


    assertEquals(new Path("/").string, "/")
  })

  await test.step("write and read", async () => {
    const tmp = Path.mktemp({prefix: "tea-"})

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
    const tmp = Path.mktemp({prefix: "tea-"})

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

  await test.step("test symlink created", () => {
    const tmp = Path.mktemp({prefix: "tea-"}).join("foo").mkdir()
    const a = tmp.join("a").touch()
    const b = tmp.join("b")
    b.ln('s', { target: a })
    assertEquals(b.readlink(), a)
    assert(b.isSymlink())
  })
})

Deno.test("Path.cwd", () => {
  const cwd = Path.cwd()
  assertEquals(cwd.string, Deno.cwd())
})

Deno.test("normalization", () => {
  assertEquals(new Path("/a/b/").string, "/a/b")
  assertEquals(new Path("/a/b////").string, "/a/b")
  assertEquals(new Path("/a/b").string, "/a/b")
  assertEquals(new Path("/a////b").string, "/a/b")
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

Deno.test("Path.isExecutableFile()", () => {
  const tmp = Path.mktemp({prefix: "tea-"}).mkdir()
  const executable = tmp.join("executable").touch()
  executable.chmod(0o755)
  const notExecutable = tmp.join("not-executable").touch()

  assert(executable.isExecutableFile())
  assertFalse(notExecutable.isExecutableFile())
})

Deno.test("Path.extname()", () => {
  const path = new Path("/home/user/file.txt")
  assertEquals(path.extname(), ".txt")
})

Deno.test("Path.mv()", () => {
  const tmp = Path.mktemp({prefix: "tea-"})
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
  const tmp = Path.mktemp({prefix: "tea-"}).mkdir()
  const a = tmp.join("a").touch()
  const b = tmp.join("b").mkdir()

  a.cp({ into: b })
  assert(b.join("a").isReadableFile())
  assert(a.isReadableFile())
})

Deno.test("Path.relative()", () => {
  const a = new Path("/home/user/file.txt")
  const b = new Path("/home/user/dir")
  assertEquals(a.relative({ to: b }), "../file.txt")
  assertEquals(b.relative({ to: a }), "../dir")
})

Deno.test("Path.realpath()", () => {
  const tmp = Path.mktemp({prefix: "tea-"}).mkdir()
  const a = tmp.join("a").touch()
  const b = tmp.join("b").ln('s', { target: a })

  assertEquals(b.realpath(), a.realpath())
})

Deno.test("Path.prettyLocalString()", () => {
  const path = Path.home().join(".config/tea/config.toml")
  assertEquals(path.prettyLocalString(), "~/.config/tea/config.toml")

  assertEquals(new Path("/a/b").prettyLocalString(), "/a/b")
})

Deno.test("Path.chuzzle()", () => {
  const path = Path.mktemp().join("file.txt").touch()
  assertEquals(path.chuzzle(), path)

  const missingPath = path.parent().join("ghost.void")
  assertEquals(missingPath.chuzzle(), undefined)
})

Deno.test("Path.ls()", async () => {
  const tmp = Path.mktemp({prefix: "tea-"}).mkdir()
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