export function flock(fd: number, op: 'ex' | 'un') {
  if (op == 'ex') {
    Deno.flockSync(fd, true)
  } else {
    Deno.funlockSync(fd)
  }
}
