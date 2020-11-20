#!/usr/bin/env node
/*
 * `truffle-plugin-verify` expects the metadata to contain absolute paths of solidity source files.
 * Since the bytecode includes metadata hash, in order to have the bytecode compiled from the same source
 * on two different machines (from different folders) be the same, metadata shall contain relative paths.
 * This script patches `truffle-plugin-verify` to make it properly work both with the absolute paths and
 * the relative paths to solidity source files in the metadata.
 * Tested with truffle-plugin-verify@0.5.0.
 */

const fs = require("fs");

const OLD_STR = "require.resolve(contractPath)";
const NEW_STR = "((p, o) => { try { return require.resolve(p);} catch(e) { return require.resolve(path.resolve(o.workingDir, p));}})(contractPath, options)"

const fixFile = (file) => {
  console.log("Patching " + file);
  const data = fs.readFileSync(file, { encoding: "utf8" });
  fs.writeFileSync(file, data.split(OLD_STR).join(NEW_STR), { encoding: "utf8" });
}

([
  "node_modules/truffle-plugin-verify/verify.js",
]).forEach(fixFile);
