import assert from "node:assert/strict";
import { nextTheme } from "./theme";

assert.equal(nextTheme("light"), "dark");
assert.equal(nextTheme("dark"), "light");

console.log("theme.check ok");
