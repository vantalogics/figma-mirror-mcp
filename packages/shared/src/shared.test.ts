import { describe, expect, test } from "bun:test";
import { descendants, inferTokens, searchNodes, snapshotManifestSchema, type MirrorNode } from ".";

const nodes: MirrorNode[] = [
  { id: "1", parentId: null, name: "Dashboard", type: "FRAME", path: "Dashboard", depth: 0, visible: true, children: ["2"], data: { itemSpacing: 16, cornerRadius: 8 } },
  { id: "2", parentId: "1", name: "Revenue", type: "TEXT", path: "Dashboard / Revenue", depth: 1, visible: true, children: [], data: { characters: "Monthly revenue", fontSize: 24, fills: [{ color: { hex: "#112233" } }] } },
];

test("queries a bounded tree and human paths", () => expect(descendants(nodes, "1", 1)).toHaveLength(2));
test("searches text and paths", () => expect(searchNodes(nodes, "monthly")[0]?.id).toBe("2"));
test("keeps inferred tokens separate", () => expect(inferTokens(nodes).fontSizes[0]).toEqual({ value: "24", count: 1 }));
test("rejects manifests without their root", () => expect(() => snapshotManifestSchema.parse({ snapshotVersion: 1, pluginVersion: "1", projectName: "x", documentName: "x", pageName: "x", rootNodeId: "missing", rootNodeName: "x", scope: "SELECTION", exportedAt: new Date().toISOString(), nodes, assets: [], screenshots: [], variables: [], collections: [], styles: [], components: [], warnings: [] })).toThrow());
