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

  const file = await Deno.open(path.string, opts)
  // denolint-disable-next-line deno-deprecated-deno-api
  await Deno.flock(file.rid, true)

  return async () => {
    try {
      // denolint-disable-next-line deno-deprecated-deno-api
      await Deno.funlock(file.rid)
    } finally {
      file.close()
    }
    if (Deno.build.os == 'windows') path.rm()
  }
}
