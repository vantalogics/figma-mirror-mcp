import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { MirrorNode } from "@figma-mirror/shared";
import sharp from "sharp";

export type ScreenshotAsset = {
  nodeId: string;
  kind: string;
  mimeType: string;
  hash: string;
  path: string;
};

type Box = { x: number; y: number; width: number; height: number };

const box = (node: MirrorNode): Box | undefined => {
  const absolute = node.data.absoluteBoundingBox;
  if (absolute && typeof absolute === "object") {
    const value = absolute as Record<string, unknown>;
    if ([value.x, value.y, value.width, value.height].every((item) => typeof item === "number")) {
      return value as Box;
    }
  }
  if ([node.absoluteX, node.absoluteY, node.width, node.height].every((item) => typeof item === "number")) {
    return { x: node.absoluteX!, y: node.absoluteY!, width: node.width!, height: node.height! };
  }
};

export function findClosestScreenshot(nodes: MirrorNode[], assets: ScreenshotAsset[], targetNodeId: string) {
  const screenshots = new Map(assets.filter((asset) => asset.kind === "SCREENSHOT").map((asset) => [asset.nodeId, asset]));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = byId.get(targetNodeId);
  while (current) {
    const asset = screenshots.get(current.id);
    if (asset) return { asset, sourceNode: current, exact: current.id === targetNodeId };
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
}

export function calculateScreenshotCrop(source: MirrorNode, target: MirrorNode, imageWidth: number, imageHeight: number) {
  const sourceBox = box(source);
  const targetBox = box(target);
  if (!sourceBox || !targetBox || sourceBox.width <= 0 || sourceBox.height <= 0) throw new Error("Screenshot crop geometry is unavailable");
  const scaleX = imageWidth / sourceBox.width;
  const scaleY = imageHeight / sourceBox.height;
  const left = Math.max(0, Math.min(imageWidth - 1, Math.floor((targetBox.x - sourceBox.x) * scaleX)));
  const top = Math.max(0, Math.min(imageHeight - 1, Math.floor((targetBox.y - sourceBox.y) * scaleY)));
  const right = Math.max(left + 1, Math.min(imageWidth, Math.ceil((targetBox.x + targetBox.width - sourceBox.x) * scaleX)));
  const bottom = Math.max(top + 1, Math.min(imageHeight, Math.ceil((targetBox.y + targetBox.height - sourceBox.y) * scaleY)));
  return { left, top, width: right - left, height: bottom - top, scaleX, scaleY };
}

export async function resolveScreenshot(options: {
  snapshotId: string;
  targetNodeId: string;
  nodes: MirrorNode[];
  assets: ScreenshotAsset[];
  dataDir: string;
  load: (nodeId: string) => Promise<{ bytes: Uint8Array; mimeType: string }>;
}) {
  const target = options.nodes.find((node) => node.id === options.targetNodeId);
  if (!target) throw new Error("Screenshot target node not found");
  const closest = findClosestScreenshot(options.nodes, options.assets, target.id);
  if (!closest) throw new Error("No screenshot contains this node");
  if (closest.exact) {
    const image = await options.load(closest.asset.nodeId);
    return { ...image, absolutePath: resolve(options.dataDir, closest.asset.path), sourceNodeId: closest.sourceNode.id, cropped: false as const };
  }

  const safeNodeId = target.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const safeHash = closest.asset.hash.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32);
  const derivedDir = resolve(options.dataDir, options.snapshotId, "derived");
  const absolutePath = resolve(derivedDir, `${safeNodeId}-${safeHash}.png`);
  const cached = Bun.file(absolutePath);
  if (await cached.exists()) {
    return { bytes: new Uint8Array(await cached.arrayBuffer()), mimeType: "image/png", absolutePath, sourceNodeId: closest.sourceNode.id, cropped: true as const };
  }

  const source = await options.load(closest.asset.nodeId);
  const pipeline = sharp(Buffer.from(source.bytes));
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Could not read source screenshot dimensions");
  const crop = calculateScreenshotCrop(closest.sourceNode, target, metadata.width, metadata.height);
  const bytes = new Uint8Array(await pipeline.extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height }).png().toBuffer());
  await mkdir(derivedDir, { recursive: true });
  await Bun.write(absolutePath, bytes);
  return { bytes, mimeType: "image/png", absolutePath, sourceNodeId: closest.sourceNode.id, cropped: true as const, crop };
}
