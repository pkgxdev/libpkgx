![tea](https://tea.xyz/banner.png)

<p align="center">
  <a href="https://twitter.com/teaxyz">
    <img src="https://img.shields.io/badge/-teaxyz-2675f5?logo=twitter&logoColor=fff" alt="Twitter" />
  </a>
  <a href="https://discord.tea.xyz">
    <img src="https://img.shields.io/discord/906608167901876256?label=discord&color=1bcf6f&logo=discord&logoColor=fff" alt="Discord" />
  </a>
  <a href='https://coveralls.io/github/teaxyz/lib?branch=main'>
    <img src='https://coveralls.io/repos/github/teaxyz/lib/badge.svg?branch=main' alt='Coverage Status' />
  </a>
  <a href="https://docs.tea.xyz">
    <img src="https://img.shields.io/badge/-docs-2675f5?logoColor=fff&color=ff00ff&logo=gitbook" alt="Documentation & Manual" />
  </a>
</p>


# libtea

tea aims to provide packaging primitives. This library is a route to that
goal. libtea can install and provide sandboxed environments for packages
without you or your user needing to install [tea/cli]

## Importing libtea

```sh
$ npm i https://github.com/teaxyz/libx
# ^^ we’ll publish to npm after we’ve worked out the rough edges
```

Or with Deno:

```ts
import * as tea from "https://raw.github.com/teaxyz/lib/v0/mod.ts"
```

## Usage

To install Python 3.10 into `~/.tea`

```ts
import { prefab, semver, hooks } from "tea"
import { exec } from "node:child_process"
const { install, hydrate, resolve } = prefab
const { useSync, useShellEnv } = hooks

// ensure pantry exists and is up-to-date
await useSync()

// define the pkg(s) you want
// see https://devhints.io/semver for semver syntax (~, ^, etc)
const pkg = { project: 'python.org', constraint: semver.Range("~3.10") }
// hydrate the full dependency tree
const { pkgs: tree } = await hydrate(pkg)
// resolve the tree of constraints to specific package versions
const { installed, pending } = await resolve(tree)

for (const pkg of pending) {
  const install = await install(pkg)
  // ^^ install packages that aren’t yet installed
  // ^^ takes a logger parameter so you can show progress to the user
  // ^^ you could do these in parallel to speed things up
  installed.push(install)
}

const { map, flatten } = useShellEnv()
const env = flatten(map(installed))

exec("python -c 'print(\"Hello, World!\")'", { env })

// the above is quite verbose, but we’ll provide a façade pattern soon
```

All of tea’s packages are relocatable so you can configure libtea to install
wherever you want:

```ts
import { hooks } from "tea"
const { useConfig } = hooks

useConfig({ prefix: "/my/installation/directory" })
// ^^ must be done before any other libtea calls

// now installs and env will use this prefix
```

### Notes

We use a hook-like pattern because it is great. This library is not itself
designed for React.

### Caveats

If the user has no existing tea/cli or you use your own prefix then the
pantry must be sync’d with `useSync()` at least once. `useSync` requires
either `git` or `tar` to be in `PATH`. We’ll remove this requirement with
time.

We have our own implementation of semver because open source has existed for
decades and Semantic Versioning is much newer than that. Our implementation is
quite compatible but not completely so. Use our semver with with libtea.
Our implementation is 100% compatible with strings output from node’s own
semver.

Setting `useConfig()` is not thread safe. Thus if you are using web workers
you must ensure the initial call to `useConfig()` is called on the main thread
before any other calls might happen. We call it explicitly in our code so you
will need to call it yourself in such a case. This is not ideal and we’d
appreciate your help in fixing it.

There is minimal magic, [tea/cli] has magic because the end-user appreciates
it but libraries need well defined behavior. We will provide a façade patterns
to make life easier, but the primitives of libtea require you to read the
docs to use them effectively.

## What Packages are Available?

We can install anything in the [pantry].

If something you need is not there, adding to the pantry has been designed to
be an easy and enjoyable process. Your contribution is both welcome and
desired!

&nbsp;


# Contributing

We would be thrilled to hear your ideas† or receive your pull requests.

> † [discussions][discussion]

## Anatomy

The code is written with [deno] (just like [tea/cli]) but is compiled to a
node package for wider accessibility (and ∵ [tea/gui] is node/electron)

## Supporting Other Languages

We would love to port this code to every language. We are deliberately keeping
the scope *tight*. Probably we would prefer to have one repo per language.

tea has sensible rules for how packages are defined and installed so writing
a port should be simple.

Open a [discussion] to start.

[discussion]: https://github.com/orgs/teaxyz/discussions
[tea/cli]: https://github.com/teaxyz/cli
[tea/gui]: https://github.com/teaxyz/gui
[deno]: https://deno.land
[pantry]: https://github.com/teaxyz/pantry

&nbsp;


# Tasks

## Coverage

```sh
deno task test --coverage=cov_profile
deno coverage cov_profile --lcov --output=cov_profile.lcov
tea genhtml -o cov_profile/html cov_profile.lcov
open cov_profile/html/index.html
```
