import Path from "./Path.ts"

export async function flock(path: Path) {
  let opts: Deno.OpenOptions | undefined

  // Deno.open seems to not like opening directories on Windows
  // even though my research suggests it should be fine
  if (Deno.build.os == 'windows') {
    path = path.join("lockfile")
    opts = { write: true, create: true }
    // ^^ or flock fails, NOTE that we have to pass create and the file must be created! lol wut?
    // ^^ write is also necessary
  }

  const { rid: fd } = await Deno.open(path.string, opts)
  await Deno.flock(fd, true)

  return async () => {
    try {
      await Deno.funlock(fd)
    } finally {
      Deno.close(fd)
    }
    if (Deno.build.os == 'windows') path.rm()
  }
}
