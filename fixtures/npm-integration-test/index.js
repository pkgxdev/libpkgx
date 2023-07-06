const { porcelain: { run } } = require("@teaxyz/lib")
const { ConfigDefault } = require("@teaxyz/lib/hooks/useConfig")
const { ConsoleLogger } = require("@teaxyz/lib/plumbing/install")

console.log(ConfigDefault(), ConsoleLogger())

run("ls -la")

