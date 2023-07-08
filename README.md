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
goal. libtea can install and provide sandboxed environments for packages that
have no effect on the wider system without you or your user needing to install
[tea/cli].

## Getting Started

```sh
$ npm install @teaxyz/lib
# ^^ https://npmjs.com/@teaxyz/lib
```

Or with [Deno]:

```ts
import * as tea from "https://deno.land/x/libtea/mod.ts"
```

## Usage

```ts
import { porcelain } from "@teaxyz/lib";
const { run } = porcelain;

await run(`python -c 'print("Hello, World!")'`);
// ^^ installs python and its deps (into ~/.tea/python.org/v3.x.y)
// ^^ runs the command
// ^^ output goes to the terminal
// ^^ throws on execution error or non-zero exit code
// ^^ executes via `/bin/sh` (so quoting and that work as expected)
```

Capture stdout easily:

```ts
const { stdout } = await run(`ruby -e 'puts ", World!"'`, { stdout: true });
console.log("Hello,", stdout);
```

> `{ stderr: true }` also works.

If there’s a non-zero exit code, we `throw`. However, when you need to,
you can capture it instead:

```ts
const { status } = await run(`perl -e 'exit(7)'`, { status: true });
assert(status == 7);  // ^^ didn’t throw!
```

> The run function’s options also takes `env` if you need to supplement or
> replace the inherited environment (which is passed by default).

Need a specific version of something? [tea][tea/cli] can install any version
of any package:

```ts
await run(["node^16", "-e", "console.log(process.version)"]);
// => v16.18.1
```

> Notice we passed args as `string[]`. This is also supported and is often
> preferable since shell quoting rules can be tricky. If you pass `string[]`
> we execute the command directly rather than via `/bin/sh`.

All of tea’s packages are relocatable so you can configure libtea to install
wherever you want:

```ts
import { hooks, Path, porcelain } from "tea";
const { install } = porcelain;
const { useConfig } = hooks;

useConfig({ prefix: Path.home().join(".local/share/my-app") });
// ^^ must be done **before** any other libtea calls

const go = await install("go.dev");
// ^^ go.path = /home/you/.local/share/my-app/go.dev/v1.20.4
```

### Designed for Composibility

The library is split into [plumbing] and [porcelain] (copying git’s lead).
The porcelain is what most people need, but if you need more control, dive
into the porcelain sources to see how to use the plumbing primitives to get
precisely what you need.

For example if you want to run a command with node’s `spawn` instead it is
simple enough to first use our porcelain `install` function then grab the
`env` you’ll need to pass to `spawn` using our `useShellEnv` hook.

Perhaps what you create should go into the porcelain? If so, please open a PR.

### Logging

Most functions take an optional `logger` parameter so you can output logging
information if you so choose. `tea/cli` has a fairly sophisticated logger, so
go check that out if you want. For our porcelain functions we provide a simple
debug-friendly logger (`ConsoleLogger`) that will output everything via
`console.error`:

```ts
import { porcelain, plumbing, utils } from "tea"
const { ConsoleLogger } = utils
const { run } = porcelain

const logger = ConsoleLogger()
await run("youtube-dl youtu.be/xiq5euezOEQ", { logger }).exec()
```

### Caveats

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

The plumbing has no magic. Libraries need well defined behavior.
You’ll need to read the docs to use them effectively.

libtea almost certainly will not work in a browser. Potentially its possible.
The first step would be compiling our bottles to WASM. We could use your help
with that…

We use a hook-like pattern because it is great. This library is not itself
designed for React.

We support the same platforms as [tea/cli].

## What Packages are Available?

We can install anything in the [pantry].

If something you need is not there, adding to the pantry has been designed to
be an easy and enjoyable process. Your contribution is both welcome and
desired!

To see what is available refer to the [pantry] docs or you can run:
`tea pkg search foo`.

&nbsp;

# Interesting Uses

* You can grab cURL’s CA certificates which we pkg and keep up to date
  (`curl.se/ca-certs`). These are commonly needed across ecosystems but not
  always easily accessible.
* grab libraries that wrappers need like openssl or sqlite
* run a real database (like postgres) easily
* load local AI models and their engines
* load libraries and then use ffi to load symbols

&nbsp;

# Contributing

We would be thrilled to hear your ideas† or receive your pull requests.

> † [discussions][discussion]

## Anatomy

The code is written with Deno (just like [tea/cli]) but is compiled to a
node package for wider accessibility (and ∵ [tea/gui] is node/electron).

The library is architected into hooks, plumbing and porcelain. Where the hooks
represent the low level primitives of pkging, the plumbing glues those
primitives together into useful components and the porcelain is a user
friendly *façade* pattern for the plumbing.

## Supporting Other Languages

We would love to port this code to every language. We are deliberately keeping
the scope *tight*. Probably we would prefer to have one repo per language.

tea has sensible rules for how packages are defined and installed so writing
a port should be simple.

We would love to explore how possible writing this in rust and then compiling
to WASM for all other languages would be. Can you help?

Open a [discussion] to start.

[discussion]: https://github.com/orgs/teaxyz/discussions
[tea/cli]: https://github.com/teaxyz/cli
[tea/gui]: https://github.com/teaxyz/gui
[Deno]: https://deno.land
[pantry]: https://github.com/teaxyz/pantry
[plumbing]: ./plumbing/
[porcelain]: ./porcelain/

&nbsp;


# Tasks

Run eg. `xc coverage` or `xc bump patch`.

## Coverage

```sh
deno task test --coverage=cov_profile
deno coverage cov_profile --lcov --output=cov_profile.lcov
tea genhtml -o cov_profile/html cov_profile.lcov
open cov_profile/html/index.html
```

## Bump

Bumps version by creating a pre-release which then engages the deployment
infra in GitHub Actions.

Inputs: LEVEL

```sh
if ! git diff-index --quiet HEAD --; then
  echo "error: dirty working tree" >&2
  exit 1
fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
  echo "error: requires main branch" >&2
  exit 1
fi

V=$(git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*")
V=$(tea semverator bump $V $LEVEL)

git push origin main
tea gh release create "v$V"-rc --prerelease --generate-notes --title "v$V"
```
