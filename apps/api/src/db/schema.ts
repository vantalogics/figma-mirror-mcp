import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const snapshotStatus = pgEnum("snapshot_status", ["CREATING", "READY", "FAILED"]);
export const projects = pgTable("projects", {
  id: uuid().primaryKey().defaultRandom(), name: text().notNull(), source: text().notNull().default("FIGMA_PLUGIN"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("projects_name_source_unique").on(table.name, table.source)]);
export const snapshots = pgTable("snapshots", {
  id: uuid().primaryKey().defaultRandom(), projectId: uuid().notNull().references(() => projects.id), version: integer().notNull(), status: snapshotStatus().notNull().default("CREATING"),
  documentName: text().notNull(), pageName: text().notNull(), rootNodeId: text().notNull(), rootNodeName: text().notNull(), nodeCount: integer().notNull().default(0),
  metadata: jsonb().$type<Record<string, unknown>>().notNull(), error: text(), createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("snapshot_project_version_unique").on(table.projectId, table.version), index("snapshot_ready_idx").on(table.projectId, table.status, table.createdAt)]);
export const nodes = pgTable("nodes", {
  id: uuid().primaryKey().defaultRandom(), snapshotId: uuid().notNull().references(() => snapshots.id, { onDelete: "cascade" }), figmaNodeId: text().notNull(), parentNodeId: text(),
  name: text().notNull(), type: text().notNull(), path: text().notNull(), depth: integer().notNull(), data: jsonb().$type<Record<string, unknown>>().notNull(), searchText: text().notNull(),
}, (table) => [uniqueIndex("nodes_snapshot_figma_unique").on(table.snapshotId, table.figmaNodeId), index("nodes_snapshot_idx").on(table.snapshotId)]);
export const assets = pgTable("assets", {
  id: uuid().primaryKey().defaultRandom(), snapshotId: uuid().notNull().references(() => snapshots.id, { onDelete: "cascade" }), nodeId: text().notNull(), externalId: text().notNull(), kind: text().notNull(),
  mimeType: text().notNull(), hash: text().notNull(), path: text().notNull(), metadata: jsonb().$type<Record<string, unknown>>().notNull(),
}, (table) => [uniqueIndex("assets_snapshot_external_unique").on(table.snapshotId, table.externalId), index("assets_snapshot_node_idx").on(table.snapshotId, table.nodeId)]);
