import { PlainObject, isString, isNumber } from "is-what"
import { PackageRequirement } from "../types.ts"
import { validate } from "./misc.ts"
import * as semver from "./semver.ts"
import host from "./host.ts"

export function validatePackageRequirement(input: PlainObject): PackageRequirement | undefined {
  let { constraint, project } = input

  if (host().platform == 'darwin' && (project == "apple.com/xcode/clt" || project == "tea.xyz/gx/make")) {
    // Apple will error out and prompt the user to install
    //NOTE what we would really like is to error out when this dependency is *used*
    // this is not the right place to error that. so FIXME
    return  // compact this dep away
  }
  if (host().platform == 'linux' && project == "tea.xyz/gx/make") {
    project = "gnu.org/make"
    constraint = '*'
  }

  validate.str(project)

  //HACKS
  if (constraint == 'c99' && project == 'tea.xyz/gx/cc') {
    constraint = '^0.1'
  }

  if (constraint === undefined) {
    constraint = '*'
  } else if (isNumber(constraint)) {
    //FIXME change all pantry entries to use proper syntax
    constraint = `^${constraint}`
  }
  if (!isString(constraint)) {
    throw new Error(`invalid constraint: ${constraint}`)
  } else if (/^\d/.test(constraint)) {
    //FIXME change all pantry entries to use proper syntax
    constraint = `^${constraint}`
  }

  constraint = new semver.Range(constraint)

  return {
    project,
    constraint
  }
}
