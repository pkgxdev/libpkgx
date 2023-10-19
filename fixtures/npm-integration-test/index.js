const { porcelain: { run } } = require("libpkgx")
const { ConfigDefault } = require("libpkgx/hooks/useConfig")
const { ConsoleLogger } = require("libpkgx/plumbing/install")

console.log(ConfigDefault(), ConsoleLogger())

run("ls -h")
