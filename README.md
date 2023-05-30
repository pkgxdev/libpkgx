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
import * as tea from "https://raw.github.com/teaxyz/lib/v0/mod.ts"
```

## Usage

To use [whisper.cpp] to transcribe a file

```ts
const { porcelain: { run: exec } } = require("@teaxyz/lib")
const exec = require('util').promisify(exec)

const { stdout } = await exec(`whisper.cpp ${wav_file_to_transcribe}`)
// ^^ installs whisper.cpp and its deps into ~/.tea, then runs it

console.log("transcription:", stdout)
```

All of tea’s packages are relocatable so you can configure libtea to install
wherever you want:

```ts
import { hooks, Path } from "tea"
const { useConfig } = hooks

useConfig({ prefix: Path.home().join(".local/share/my-app") })
// ^^ must be done before any other libtea calls

// now if you install, eg, python you’ll get:
//     /home/you/.local/share/my-app/python.org/v3.10.11/bin/python
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

libtea almost certainly will not work in a browser. Potentially its possible.
The first step would be compiling our bottles to WASM. We could use your help
with that…

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

The code is written with Deno (just like [tea/cli]) but is compiled to a
node package for wider accessibility (and ∵ [tea/gui] is node/electron)

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
V=$(tea semverator bump $V $PRIORITY)

git push origin main
tea gh release create "v$V" --prerelease --generate-notes --title
```
