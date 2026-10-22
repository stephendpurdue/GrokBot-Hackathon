import assert from "node:assert/strict";
import { filterCommands, type CommandGroup } from "./commands";

const groups: CommandGroup[] = [
  {
    label: "Go",
    items: [{ id: "settings", label: "Settings", detail: "Clear saved connections", href: "/settings" }],
  },
  {
    label: "Connections",
    items: [{ id: "ada", label: "Ada Okonkwo", detail: "@ada · A Rust CLI" }],
  },
];

assert.equal(filterCommands(groups, "  "), groups);
assert.deepEqual(
  filterCommands(groups, "rust").map((group) => group.label),
  ["Connections"],
);
assert.deepEqual(
  filterCommands(groups, "set").map((group) => group.items.map((item) => item.id)),
  [["settings"]],
);
assert.deepEqual(filterCommands(groups, "nope"), []);

console.log("commands.check ok");
