export async function flock(fd: number, op: "ex" | "un") {
  if (op == "ex") {
    await Deno.flock(fd, true)
  } else {
    await Deno.funlock(fd)
  }
}
