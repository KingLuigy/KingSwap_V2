#!/bin/env node
/*
 * On compilation, Truffle includes absolute paths to solidity source files into metadata.
 * Since the bytecode contains the metadata hash, the bytecode compiled from the same source
 * on two different machines (from different folders) may differ.
 * This script patches truffle to make it replace absolute paths with relative ones.
 * The feature activated by `--fix_paths` cli flag, or `fix_paths: true` truffle config option.
 * Tested with truffle@5.1.50.
 *
 * Idea: https://ethereum.stackexchange.com/questions/66284/is-it-safe-to-commit-truffle-build-files-to-github-open-source/66298#66298
 */

const fs = require("fs");

const OLD_STR = "options.compilationTargets = compilationTargets;";
const NEW_STR = OLD_STR + " " +
    "if (options.fix_paths) Object.keys(allSources).forEach((p) => {" +
    " if (!path.isAbsolute(p)) return;" +
    " allSources[path.relative(options.working_directory, p)] = allSources[p];" +
    " delete allSources[p];" +
    "});";

const fixFile = (file) => {
  console.log("Patching " + file);
  const data = fs.readFileSync(file, { encoding: "utf8" });
  fs.writeFileSync(file, data.split(OLD_STR).join(NEW_STR), { encoding: "utf8" });
}

([
  "./node_modules/truffle/build/cli.bundled.js",
  "./node_modules/truffle/build/commands.bundled.js",
]).forEach(fixFile);
