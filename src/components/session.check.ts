import assert from "node:assert/strict";
import { contactLinks, parseConnections } from "./session";

assert.deepEqual(parseConnections(null), []);
assert.deepEqual(parseConnections("nope"), []);
assert.deepEqual(
  parseConnections(JSON.stringify([{ displayName: "Ada", handle: "ada", building: "A CLI.", shared: ["rust"] }, { bad: true }])),
  [],
);
assert.deepEqual(parseConnections(JSON.stringify([{ displayName: "Ada", handle: "ada", building: "A CLI.", shared: ["rust"] }])), [
  { displayName: "Ada", handle: "ada", building: "A CLI.", shared: ["rust"] },
]);

assert.deepEqual(contactLinks({ github: "chioma-not-a-real-user", site: "javascript:alert(1)" }), [
  { label: "GitHub", href: "https://github.com/chioma-not-a-real-user" },
]);
assert.deepEqual(contactLinks({ site: "https://example.com/about" }), [
  { label: "Site", href: "https://example.com/about" },
]);
assert.deepEqual(contactLinks(undefined), []);

console.log("session.check ok");
