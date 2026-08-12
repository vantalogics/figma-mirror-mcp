import type { MirrorNode } from "./schema";

export function descendants(nodes: MirrorNode[], rootId: string, depth = 1): MirrorNode[] {
  const byParent = new Map<string, MirrorNode[]>();
  for (const node of nodes) if (node.parentId) byParent.set(node.parentId, [...(byParent.get(node.parentId) ?? []), node]);
  const result: MirrorNode[] = [];
  let frontier = [rootId];
  for (let level = 0; level <= depth && frontier.length; level++) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = nodes.find((candidate) => candidate.id === id);
      if (node) result.push(node);
      for (const child of byParent.get(id) ?? []) next.push(child.id);
    }
    frontier = next;
  }
  return result;
}

export function searchNodes(nodes: MirrorNode[], query: string, types?: string[], limit = 20) {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return nodes.filter((node) => !types?.length || types.includes(node.type)).map((node) => {
    const haystack = `${node.name} ${node.path} ${node.type} ${String(node.data.characters ?? "")} ${String(node.data.componentName ?? "")}`.toLocaleLowerCase();
    return { node, score: words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0) };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.node.depth - b.node.depth).slice(0, limit).map(({ node }) => node);
}
