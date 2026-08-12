import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import type { SnapshotManifest } from "@figma-mirror/shared";
import { db } from "./db";
import { assets, nodes, projects, snapshots } from "./db/schema";

export async function createSnapshot(manifest: SnapshotManifest) {
  const [project] = await db.insert(projects).values({ name: manifest.projectName }).onConflictDoUpdate({ target: [projects.name, projects.source], set: { updatedAt: new Date() } }).returning();
  if (!project) throw new Error("Could not create project");
  const [next] = await db.select({ version: sql<number>`coalesce(max(${snapshots.version}), 0) + 1` }).from(snapshots).where(eq(snapshots.projectId, project.id));
  const [snapshot] = await db.insert(snapshots).values({ projectId: project.id, version: Number(next?.version ?? 1), documentName: manifest.documentName, pageName: manifest.pageName, rootNodeId: manifest.rootNodeId, rootNodeName: manifest.rootNodeName, metadata: manifest }).returning();
  if (!snapshot) throw new Error("Could not create snapshot");
  return { project, snapshot };
}
export async function finishSnapshot(snapshotId: string, manifest: SnapshotManifest, stored: Array<{ externalId: string; path: string }>) {
  await db.transaction(async (tx) => {
    await tx.insert(nodes).values(manifest.nodes.map((node) => ({ snapshotId, figmaNodeId: node.id, parentNodeId: node.parentId, name: node.name, type: node.type, path: node.path, depth: node.depth, data: node as unknown as Record<string, unknown>, searchText: `${node.name} ${node.path} ${node.type} ${String(node.data.characters ?? "")} ${String(node.data.componentName ?? "")}` })));
    const files = [...manifest.assets, ...manifest.screenshots];
    if (files.length) await tx.insert(assets).values(files.map((file) => ({ snapshotId, nodeId: file.sourceNodeId, externalId: file.id, kind: file.kind, mimeType: file.mimeType, hash: file.hash, path: stored.find((item) => item.externalId === file.id)?.path ?? "", metadata: file })));
    await tx.update(snapshots).set({ status: "READY", nodeCount: manifest.nodes.length, metadata: manifest }).where(eq(snapshots.id, snapshotId));
  });
}
export const failSnapshot = (id: string, error: string) => db.update(snapshots).set({ status: "FAILED", error }).where(eq(snapshots.id, id));
export const listProjects = () => db.select().from(projects).orderBy(asc(projects.name));
export const listSnapshots = (projectId?: string) => db.select().from(snapshots).where(and(eq(snapshots.status, "READY"), projectId ? eq(snapshots.projectId, projectId) : undefined)).orderBy(desc(snapshots.createdAt));
export async function getSnapshot(id: string) { const [snapshot] = await db.select().from(snapshots).where(and(eq(snapshots.id, id), eq(snapshots.status, "READY"))); return snapshot; }
export async function getLatest(projectId: string) { const [snapshot] = await db.select().from(snapshots).where(and(eq(snapshots.projectId, projectId), eq(snapshots.status, "READY"))).orderBy(desc(snapshots.version)).limit(1); return snapshot; }
const readyNodeJoin = and(eq(nodes.snapshotId, snapshots.id), eq(snapshots.status, "READY"));
const readyAssetJoin = and(eq(assets.snapshotId, snapshots.id), eq(snapshots.status, "READY"));
export const getNodes = (snapshotId: string) => db.select(getTableColumns(nodes)).from(nodes).innerJoin(snapshots, readyNodeJoin).where(eq(nodes.snapshotId, snapshotId)).orderBy(asc(nodes.depth), asc(nodes.path));
export async function getNode(snapshotId: string, nodeId: string) { const [node] = await db.select(getTableColumns(nodes)).from(nodes).innerJoin(snapshots, readyNodeJoin).where(and(eq(nodes.snapshotId, snapshotId), eq(nodes.figmaNodeId, nodeId))); return node; }
export const findNodes = (snapshotId: string, query: string, types?: string[], limit = 20) => db.select(getTableColumns(nodes)).from(nodes).innerJoin(snapshots, readyNodeJoin).where(and(eq(nodes.snapshotId, snapshotId), or(ilike(nodes.name, `%${query}%`), ilike(nodes.path, `%${query}%`), ilike(nodes.searchText, `%${query}%`)), types?.length ? inArray(nodes.type, types) : undefined)).limit(Math.min(Number.isFinite(limit) ? limit : 20, 100));
export async function getAsset(snapshotId: string, externalId?: string, nodeId?: string, kind?: string) { const [asset] = await db.select(getTableColumns(assets)).from(assets).innerJoin(snapshots, readyAssetJoin).where(and(eq(assets.snapshotId, snapshotId), externalId ? eq(assets.externalId, externalId) : undefined, nodeId ? eq(assets.nodeId, nodeId) : undefined, kind ? eq(assets.kind, kind) : undefined)); return asset; }
export const getAssets = (snapshotId: string) => db.select(getTableColumns(assets)).from(assets).innerJoin(snapshots, readyAssetJoin).where(eq(assets.snapshotId, snapshotId));
