import { PackageRequirement } from "../types.ts"
import { isString, isNumber } from "is-what"
import * as semver from "./semver.ts"
import host from "./host.ts"

export function validatePackageRequirement(project: string, constraint: unknown): PackageRequirement | undefined
{
  if (host().platform == 'darwin' && (project == "apple.com/xcode/clt" || project == "tea.xyz/gx/make")) {
    // Apple will error out and prompt the user to install when the tool is used
    return  // compact this dep away
  }
  if (host().platform == 'linux' && project == "tea.xyz/gx/make") {
    project = "gnu.org/make"
    constraint = '*'
  }

  if (constraint == 'c99' && project == 'tea.xyz/gx/cc') {
    constraint = '^0.1'
  }

  if (isNumber(constraint)) {
    constraint = `^${constraint}`
  } else if (!isString(constraint)) {
    throw new Error(`invalid constraint for ${project}: ${constraint}`)
  }

  return {
    project,
    constraint: new semver.Range(constraint as string)
  }
}
