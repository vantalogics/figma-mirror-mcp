import { describe, expect, test } from "bun:test";
import type { MirrorNode } from "@figma-mirror/shared";
import { calculateScreenshotCrop, findClosestScreenshot } from "./screenshot";

const node = (id: string, parentId: string | null, depth: number, x: number, y: number, width: number, height: number): MirrorNode => ({
  id, parentId, depth, name: id, path: id, type: "FRAME", x, y, width, height, absoluteX: x, absoluteY: y, visible: true, children: [], data: { absoluteBoundingBox: { x, y, width, height } },
});

describe("screenshot fallback", () => {
  test("finds the closest ancestor screenshot", () => {
    const root = node("root", null, 0, 100, 200, 1000, 500);
    const frame = node("frame", "root", 1, 300, 250, 200, 100);
    const child = node("child", "frame", 2, 320, 270, 20, 20);
    expect(findClosestScreenshot([root, frame, child], [{ nodeId: "root", kind: "SCREENSHOT", mimeType: "image/png", hash: "hash", path: "root.png" }], "child")?.sourceNode.id).toBe("root");
  });

  test("maps absolute Figma geometry to actual PNG pixels", () => {
    const root = node("root", null, 0, 100, 200, 1000, 500);
    const frame = node("frame", "root", 1, 300, 250, 200, 100);
    expect(calculateScreenshotCrop(root, frame, 2000, 1000)).toEqual({ left: 400, top: 100, width: 400, height: 200, scaleX: 2, scaleY: 2 });
  });
});
