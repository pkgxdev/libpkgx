#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-env
  - --allow-read
  - --allow-write
  - --allow-net
  - --allow-run
dependencies:
  npmjs.com: '*'
---*/

import { build, emptyDir } from "https://deno.land/x/dnt@0.35.0/mod.ts";
import SemVer from "../src/utils/semver.ts";

await emptyDir("./dist");

const version = (() => {
  try {
    return new SemVer(Deno.args[0]).toString();
  } catch {
    console.warn("no version specified, do not release this!")
    return '0.0.0'
  }
})()

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./dist",
  shims: {
    deno: true,
    crypto: true,
    undici: true,
    custom: [{
      package: { name: "stream/web" },
      globalNames: ["TransformStream", "ReadableStream"],
    }],
  },
  importMap: "deno.json",
  mappings: {
    "https://deno.land/x/is_what@v4.1.8/src/index.ts": "is-what",
    "https://deno.land/x/outdent@v0.8.0/mod.ts": "outdent",
    "./src/utils/flock.deno.ts": "./src/utils/flock.node.ts"
  },
  package: {
    name: "@teaxyz/lib",
    version,
    description: "pkging primitives",
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "git://github.com/teaxyz/lib.git",
    },
    bugs: {
      url: "https://github.com/teaxyz/lib/issues",
    },
    dependencies: {
      "is-what": "^4",
      "outdent": "^0.8",
    },
    devDependencies: {
      "@types/fs-ext": "^2"
    },
  },
  postBuild() {
    Deno.copyFileSync("LICENSE.txt", "dist/LICENSE.txt");
    Deno.copyFileSync("README.md", "dist/README.md");
  },
});
