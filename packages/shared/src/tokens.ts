import type { MirrorNode } from "./schema";

function frequency(values: unknown[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter((item) => item !== undefined && item !== null)) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

export function inferTokens(nodes: MirrorNode[]) {
  const data = nodes.map((node) => node.data);
  return {
    colors: frequency(data.flatMap((item) => JSON.stringify(item).match(/#[0-9A-F]{6,8}/gi) ?? [])),
    fontSizes: frequency(data.map((item) => item.fontSize)),
    radii: frequency(data.map((item) => item.cornerRadius)),
    spacing: frequency(data.flatMap((item) => [item.itemSpacing, item.paddingTop, item.paddingRight, item.paddingBottom, item.paddingLeft])),
  };
}
