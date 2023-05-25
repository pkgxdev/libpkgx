import koffi from 'npm:koffi@2'
import * as util from "node:util"
import host from "./host.ts"

const filename = host().platform == 'darwin' ? 'libSystem.dylib' : 'libc.so.6'
const libc = koffi.load(filename)

const LOCK_EX = 2;
const LOCK_UN = 8;

const cflock = libc.func('int flock(int, int)');
const flockAsync = util.promisify(cflock.async);

async function flock(fd: number, op: 'un' | 'ex') {
  const rv = await flockAsync(fd, op == 'ex' ? LOCK_EX : LOCK_UN);
  if (rv === -1) {
    throw new Error("flock failed") // TODO read errno
  }
}

export { flock }
