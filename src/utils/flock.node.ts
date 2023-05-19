import { flock as flock_base } from "npm:fs-ext@2.0.0"

function flock(fd: number, op: 'ex' | 'un') {
  return new Promise<void>((resolve, reject) => {
    flock_base(fd, op, (err: Error | null) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

export { flock }
