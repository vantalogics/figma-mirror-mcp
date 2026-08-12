import { resolve } from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://localhost:5432/figma_mirror",
  dataDir: resolve(process.env.DATA_DIR ?? "./data"),
};
