export type Command = {
  id: string;
  label: string;
  detail: string;
  href?: string;
};

export type CommandGroup = {
  label: string;
  items: Command[];
};

export function filterCommands(groups: CommandGroup[], query: string): CommandGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(q)),
    }))
    .filter((group) => group.items.length > 0);
}
