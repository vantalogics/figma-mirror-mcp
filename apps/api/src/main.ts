import { Elysia } from "elysia";
import { basename } from "node:path";
import { snapshotManifestSchema } from "@figma-mirror/shared";
import { config } from "./config";
import {
  createSnapshot,
  failSnapshot,
  findNodes,
  finishSnapshot,
  getAsset,
  getAssets,
  getLatest,
  getNode,
  getNodes,
  getSnapshot,
  listProjects,
  listSnapshots,
} from "./repository";
import { storage } from "./storage";

const jsonError = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
const app = new Elysia()
  .onAfterHandle(({ set }) => {
    set.headers["access-control-allow-origin"] = "*";
  })
  .get("/health", () => ({
    status: "ok",
    service: "figma-mirror-api",
    snapshotVersion: 1,
  }))
  .post("/snapshots", async ({ request }) => {
    const stagingId = crypto.randomUUID();
    let snapshotId: string | undefined;
    try {
      const form = await request.formData();
      const raw = form.get("manifest");
      if (typeof raw !== "string")
        return jsonError("multipart field 'manifest' is required");
      const manifest = snapshotManifestSchema.parse(JSON.parse(raw));
      const created = await createSnapshot(manifest);
      snapshotId = created.snapshot.id;
      console.error(
        JSON.stringify({
          event: "snapshot.created",
          snapshotId,
          version: created.snapshot.version,
        }),
      );
      const stored: Array<{ externalId: string; path: string }> = [];
      for (const descriptor of [...manifest.assets, ...manifest.screenshots]) {
        const file = form.get(`file:${descriptor.id}`);
        if (!(file instanceof File))
          throw new Error(`Missing binary file:${descriptor.id}`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
        if (descriptor.hash !== "pending" && `sha256-${hash}` !== descriptor.hash)
          throw new Error(`Hash mismatch for ${descriptor.id}`);
        descriptor.hash = `sha256-${hash}`;
        const folder =
          descriptor.kind === "SCREENSHOT" ? "screenshots" : "assets";
        const extension = descriptor.mimeType === "image/svg+xml" ? "svg" : descriptor.mimeType === "image/png" ? "png" : "bin";
        const filename = descriptor.kind === "SCREENSHOT" ? basename(descriptor.filename) : `sha256-${hash}.${extension}`;
        descriptor.filename = filename;
        const path = `${folder}/${filename}`;
        await storage.put(stagingId, path, bytes);
        stored.push({
          externalId: descriptor.id,
          path: `${snapshotId}/${path}`,
        });
      }
      await storage.commit(stagingId, snapshotId);
      await finishSnapshot(snapshotId, manifest, stored);
      console.error(
        JSON.stringify({
          event: "snapshot.ready",
          snapshotId,
          nodes: manifest.nodes.length,
        }),
      );
      return {
        id: snapshotId,
        projectId: created.project.id,
        version: created.snapshot.version,
        status: "READY",
        nodeCount: manifest.nodes.length,
      };
    } catch (error) {
      await storage.discard(stagingId);
      if (snapshotId)
        await failSnapshot(
          snapshotId,
          error instanceof Error ? error.message : String(error),
        );
      console.error(
        JSON.stringify({
          event: "snapshot.failed",
          snapshotId,
          error: String(error),
        }),
      );
      return jsonError(error instanceof Error ? error.message : String(error));
    }
  })
  .get("/projects", () => listProjects())
  .get("/snapshots", ({ query }) => listSnapshots(query.projectId))
  .get(
    "/snapshots/:id",
    async ({ params }) =>
      (await getSnapshot(params.id)) ?? jsonError("Snapshot not found", 404),
  )
  .get(
    "/projects/:id/latest",
    async ({ params }) =>
      (await getLatest(params.id)) ??
      jsonError("Ready snapshot not found", 404),
  )
  .get("/snapshots/:id/nodes", async ({ params, query }) =>
    query.q
      ? findNodes(
          params.id,
          query.q,
          query.types?.split(","),
          Number(query.limit ?? 20),
        )
      : getNodes(params.id),
  )
  .get(
    "/snapshots/:id/nodes/:nodeId",
    async ({ params }) =>
      (await getNode(params.id, params.nodeId)) ??
      jsonError("Node not found", 404),
  )
  .get("/snapshots/:id/assets", ({ params }) => getAssets(params.id))
  .get(
    "/snapshots/:id/assets/:assetId",
    async ({ params }) =>
      (await getAsset(params.id, params.assetId)) ??
      jsonError("Asset not found", 404),
  )
  .get("/snapshots/:id/screenshots/:nodeId", async ({ params }) => {
    const asset = await getAsset(
      params.id,
      undefined,
      params.nodeId,
      "SCREENSHOT",
    );
    if (!asset) return jsonError("Screenshot not found", 404);
    return Bun.file(storage.absolute(asset.path));
  })
  .listen(config.port);

console.error(
  JSON.stringify({
    event: "api.started",
    url: app.server?.url.toString(),
    dataDir: config.dataDir,
  }),
);
export type App = typeof app;
