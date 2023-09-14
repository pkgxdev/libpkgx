import { Package, PackageRequirement } from "../types.ts"
import * as semver from "../utils/semver.ts"
import usePantry from "../hooks/usePantry.ts"
import { is_what } from "../deps.ts"
const { isArray } = is_what

//TODO linktime cyclic dependencies cannot be allowed
//NOTE however if they aren’t link time it's presumably ok in some scenarios
//   eg a tool that lists a directory may depend on a tool that identifies the
//   mime types of files which could depend on the listing tool
//FIXME actually we are not refining the constraints currently
//TODO we are not actually restricting subsequent asks, eg. deno^1 but then deno^1.2

interface ReturnValue {
  /// full list topologically sorted (ie dry + wet)
  pkgs: PackageRequirement[]

  /// your input, but version constraints refined based on the whole graph
  /// eg. you hydrate the graph for a and b, but b depends on a tighter range of a than you input
  dry: PackageRequirement[]

  /// packages that were not supplied to input or that require bootstrap
  wet: PackageRequirement[]

  /// the graph cycles at these packages
  /// this is only a problem if you need to build one of these,
  // in which case TADA! here's the list!
  bootstrap_required: Set<string>
}

const get = (x: PackageRequirement) => usePantry().project(x).runtime.deps()

/// sorts a list of packages topologically based on their
/// dependencies. Throws if there is a cycle in the input.
/// ignores changes in dependencies based on versions
export default async function hydrate(
  input: (PackageRequirement | Package)[] | (PackageRequirement | Package),
  get_deps: (pkg: PackageRequirement, dry: boolean) => Promise<PackageRequirement[]> = get,
): Promise<ReturnValue> {
  if (!isArray(input)) input = [input]

  const dry = condense(input.map((spec) => {
    if ("version" in spec) {
      return { project: spec.project, constraint: new semver.Range(`=${spec.version}`) }
    } else {
      return spec
    }
  }))

  const graph: Record<string, Node> = {}
  const bootstrap = new Set<string>()
  const initial_set = new Set(dry.map((x) => x.project))
  const stack: Node[] = []

  // Starting the DFS loop for each package in the dry list
  for (const pkg of dry) {
    let new_node = graph[pkg.project]
    if (new_node) {
      // Intersect constraints for existing nodes
      new_node.pkg.constraint = semver.intersect(new_node.pkg.constraint, pkg.constraint)
    } else {
      new_node = new Node(pkg)
      graph[pkg.project] = new_node
      stack.push(new_node)
    }

    while (stack.length > 0) {
      const current_node = stack.pop()!
      const children = current_node.children

      for (const dep of await get_deps(current_node.pkg, initial_set.has(current_node.project))) {
        if (children.has(dep.project)) {
          if (!bootstrap.has(dep.project)) {
            console.warn(`tea: cyclic dep: ${dep.project}: ${current_node.project}`)
            bootstrap.add(dep.project)
          }
        } else {
          let child_node = graph[dep.project]
          if (child_node) {
            // Intersect constraints
            child_node.pkg.constraint = semver.intersect(child_node.pkg.constraint, dep.constraint)
          } else {
            child_node = new Node(dep, current_node)
            graph[dep.project] = child_node
            stack.push(child_node)
          }
          current_node.children.add(dep.project)
        }
      }
    }
  }

  // Sorting and constructing the return value
  const pkgs = Object.values(graph)
    .sort((a, b) => b.count() - a.count())
    .map(({ pkg }) => pkg)

  //TODO strictly we need to record precisely the bootstrap version constraint
  const bootstrap_required = new Set(
    pkgs.compact(({ project }) => bootstrap.has(project) && project),
  )

  return {
    pkgs,
    dry: pkgs.filter(({ project }) => initial_set.has(project)),
    wet: pkgs.filter(({ project }) => !initial_set.has(project) || bootstrap_required.has(project)),
    bootstrap_required,
  }
}

function condense(pkgs: PackageRequirement[]) {
  const out: PackageRequirement[] = []
  for (const pkg of pkgs) {
    const found = out.find((x) => x.project === pkg.project)
    if (found) {
      found.constraint = semver.intersect(found.constraint, pkg.constraint)
    } else {
      out.push(pkg)
    }
  }
  return out
}

/////////////////////////////////////////////////////////////////////////// lib
class Node {
  parent: Node | undefined
  readonly pkg: PackageRequirement
  readonly project: string
  children: Set<string> = new Set()

  constructor(pkg: PackageRequirement, parent?: Node) {
    this.parent = parent
    this.pkg = pkg
    this.project = pkg.project
  }

  count(): number {
    let n = 0
    // deno-lint-ignore no-this-alias
    let node: Node | undefined = this
    while ((node = node?.parent)) n++
    return n
  }
}
