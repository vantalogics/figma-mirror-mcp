import { z } from "zod";

export const colorSchema = z.object({
  r: z.number(), g: z.number(), b: z.number(), a: z.number(), hex: z.string(),
});

export const paintSchema = z.object({
  type: z.string(), visible: z.boolean().optional(), opacity: z.number().optional(),
  blendMode: z.string().optional(), color: colorSchema.optional(),
  gradientStops: z.array(z.object({ position: z.number(), color: colorSchema })).optional(),
  gradientTransform: z.array(z.array(z.number())).optional(), imageHash: z.string().nullable().optional(),
  scaleMode: z.string().optional(), variable: z.string().optional(),
}).passthrough();

export const nodeSchema = z.object({
  id: z.string(), parentId: z.string().nullable(), name: z.string(), type: z.string(), path: z.string(), depth: z.number(),
  x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(),
  absoluteX: z.number().optional(), absoluteY: z.number().optional(), visible: z.boolean(), opacity: z.number().optional(),
  rotation: z.number().optional(), children: z.array(z.string()), data: z.record(z.string(), z.unknown()),
}).strict();

export const assetSchema = z.object({
  id: z.string(), kind: z.enum(["ASSET", "SCREENSHOT"]), hash: z.string(), mimeType: z.string(),
  width: z.number().optional(), height: z.number().optional(), sourceNodeId: z.string(), filename: z.string(),
});

export const snapshotManifestSchema = z.object({
  snapshotVersion: z.literal(1), pluginVersion: z.string(), projectName: z.string(), documentName: z.string(),
  pageName: z.string(), rootNodeId: z.string(), rootNodeName: z.string(), scope: z.enum(["SELECTION", "PAGE"]),
  exportedAt: z.string().datetime(), nodes: z.array(nodeSchema).min(1), assets: z.array(assetSchema),
  screenshots: z.array(assetSchema), variables: z.array(z.record(z.string(), z.unknown())).default([]),
  collections: z.array(z.record(z.string(), z.unknown())).default([]), styles: z.array(z.record(z.string(), z.unknown())).default([]),
  components: z.array(z.record(z.string(), z.unknown())).default([]), warnings: z.array(z.string()).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.nodes.map((node) => node.id));
  if (!ids.has(value.rootNodeId)) ctx.addIssue({ code: "custom", message: "rootNodeId must reference an exported node" });
  if (ids.size !== value.nodes.length) ctx.addIssue({ code: "custom", message: "node ids must be unique" });
});

export type MirrorNode = z.infer<typeof nodeSchema>;
export type SnapshotManifest = z.infer<typeof snapshotManifestSchema>;
export type SnapshotAsset = z.infer<typeof assetSchema>;
