import * as util from "node:util"
import koffi from 'npm:koffi@2'
import lockfile from 'npm:proper-lockfile@4.1.2';
import Path from "./Path.ts";

// thank you ChatGPT

const filename = (platform => {
  switch (platform) {
  case 'darwin':
    return '/usr/lib/libSystem.dylib'
  case 'windows':
    return 'Kernel32.dll'
  default:
    return 'libc.so.6'
  }
})(Deno.build.os)
const libc = koffi.load(filename)

async function flock(path: Path) {
  if (Deno.build.os != 'windows') {
    const LOCK_EX = 2;
    const LOCK_UN = 8;
    const cflock = libc.func('int flock(int, int)');
    const flockAsync = util.promisify(cflock.async);
    const { rid: fd } = await Deno.open(path.string)

    const rv = await flockAsync(fd, LOCK_EX);
    if (rv === -1) {
      throw new Error("flock failed") // TODO read errno
    }
    return () => flockAsync(fd, LOCK_UN);
  } else {

    //TODO use LockFileEx
    //NOTE this absolutely must be done before v1 since it means our npm pkg and deno pkgs are not lock compatible
    // NOTES I tried 😔 and couldn’t figure it out. Damn Win32 bests me again.

    // NOTE retries is arbituary, we just want it to wait for the lock to be released
    // but couldn’t figure out a cleaner way to do that
    return await lockfile.lock(path.string, {retries: 100})
  }
}

export { flock }
