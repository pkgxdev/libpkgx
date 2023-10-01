#!/usr/bin/env -S pkgx +npm deno run --allow-env --allow-read --allow-write --allow-net --allow-run

import { build, emptyDir } from "https://deno.land/x/dnt@0.38.1/mod.ts";
import SemVer from "../src/utils/semver.ts";

await emptyDir("./dist");

const test = !Deno.args.includes("--no-test");

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
  test,
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
    "https://deno.land/x/is_what@v4.1.15/src/index.ts": "is-what",
    "https://deno.land/x/outdent@v0.8.0/mod.ts": "outdent",
    "./src/utils/flock.deno.ts": "./src/utils/flock.node.ts"
  },
  package: {
    name: "libpkgx",
    version,
    description: "pkging primitives",
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "git://github.com/pkgxdev/libpkgx.git",
    },
    bugs: {
      url: "https://github.com/pkgxdev/libpkgx/issues",
    },
    dependencies: {
      "is-what": "^4",
      "outdent": "^0.8",
    },
    exports: {
      "./src/src/utils/semver": {
        //TODO remove when gui is updated to use `libpkgx/semver`
        import: "./src/src/utils/semver.ts"
      },
      "./semver": {
        import: "./esm/src/utils/semver.js",
        require: "./script/src/utils/semver.js"
      },
      "./plumbing/*": {
        "import": "./esm/src/plumbing/*.js",
        "require": "./script/src/plumbing/*.js"
      },
      "./hooks/*": {
        "import": "./esm/src/hooks/*.js",
        "require": "./script/src/hooks/*.js"
      }
    }
  },
  postBuild() {
    Deno.copyFileSync("LICENSE.txt", "dist/LICENSE.txt");
    Deno.copyFileSync("README.md", "dist/README.md");
  },
});
