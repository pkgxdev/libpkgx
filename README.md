![tea](https://tea.xyz/banner.png)

<p align="center">
  <a href="https://twitter.com/teaxyz">
    <img src="https://img.shields.io/badge/-teaxyz-2675f5?logo=twitter&logoColor=fff" alt="Twitter" />
  </a>
  <a href="https://discord.tea.xyz">
    <img src="https://img.shields.io/discord/906608167901876256?label=discord&color=1bcf6f&logo=discord&logoColor=fff" alt="Discord" />
  </a>
  <a href='https://coveralls.io/github/teaxyz/cli?branch=main'>
    <img src='https://coveralls.io/repos/github/teaxyz/lib/badge.svg?branch=main' alt='Coverage Status' />
  </a>
  <a href="https://docs.tea.xyz">
    <img src="https://img.shields.io/badge/-docs-2675f5?logoColor=fff&color=ff00ff&logo=gitbook" alt="Documentation & Manual" />
  </a>
</p>


# libtea

tea aims to provide packaging primitives. This library is a route to that
goal.

Documentation will be added over time.


# Anatomy

The code is written with [deno] because we use deno to write [tea/cli] but
is compiled to a node package because [tea/gui] is a node based Electron app.


# Supporting Other Languages

We would love to port this code to every language. We are deliberately keeping
the scope *tight*. Probably we would prefer to have one repo per language.

tea has sensible rules for how packages are defined and installed so writing
a port should be simple.

Open a [discussion] to start.

[discussion]: https://github.com/orgs/teaxyz/discussions
[tea/cli]: https://github.com/teaxyz/cli
[tea/gui]: https://github.com/teaxyz/gui
[deno]: https://deno.land
