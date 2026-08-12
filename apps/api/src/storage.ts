import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { config } from "./config";

export interface ObjectStorage { put(stagingId: string, relativePath: string, bytes: Uint8Array): Promise<string>; commit(stagingId: string, snapshotId: string): Promise<void>; discard(stagingId: string): Promise<void>; absolute(path: string): string; }
export class FileSystemStorage implements ObjectStorage {
  async put(stagingId: string, relativePath: string, bytes: Uint8Array) { const path = join(".staging", stagingId, relativePath); const absolute = this.absolute(path); await mkdir(dirname(absolute), { recursive: true }); await Bun.write(absolute, bytes); return path; }
  async commit(stagingId: string, snapshotId: string) { await mkdir(config.dataDir, { recursive: true }); await rename(this.absolute(join(".staging", stagingId)), this.absolute(snapshotId)); }
  async discard(stagingId: string) { await rm(this.absolute(join(".staging", stagingId)), { recursive: true, force: true }); }
  absolute(path: string) { const candidate = resolve(config.dataDir, path); if (!candidate.startsWith(`${config.dataDir}/`) && candidate !== config.dataDir) throw new Error("Unsafe storage path"); return candidate; }
}
export const storage = new FileSystemStorage();
