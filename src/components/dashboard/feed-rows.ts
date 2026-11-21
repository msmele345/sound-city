export function groupFeedRows<Item>(
  events: readonly Item[],
  labelFor: (event: Item) => string,
) {
  const groups: { label: string; rows: { item: Item; index: number }[] }[] = [];
  events.forEach((item, index) => {
    const label = labelFor(item);
    const row = { item, index };
    const current = groups.at(-1);
    if (current?.label === label) current.rows.push(row);
    else groups.push({ label, rows: [row] });
  });
  return groups;
}
