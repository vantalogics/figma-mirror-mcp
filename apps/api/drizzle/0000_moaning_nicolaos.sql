CREATE TYPE "public"."snapshot_status" AS ENUM('CREATING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshotId" uuid NOT NULL,
	"nodeId" text NOT NULL,
	"externalId" text NOT NULL,
	"kind" text NOT NULL,
	"mimeType" text NOT NULL,
	"hash" text NOT NULL,
	"path" text NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshotId" uuid NOT NULL,
	"figmaNodeId" text NOT NULL,
	"parentNodeId" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"depth" integer NOT NULL,
	"data" jsonb NOT NULL,
	"searchText" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source" text DEFAULT 'FIGMA_PLUGIN' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "snapshot_status" DEFAULT 'CREATING' NOT NULL,
	"documentName" text NOT NULL,
	"pageName" text NOT NULL,
	"rootNodeId" text NOT NULL,
	"rootNodeName" text NOT NULL,
	"nodeCount" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb NOT NULL,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_snapshotId_snapshots_id_fk" FOREIGN KEY ("snapshotId") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_snapshotId_snapshots_id_fk" FOREIGN KEY ("snapshotId") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_snapshot_external_unique" ON "assets" USING btree ("snapshotId","externalId");--> statement-breakpoint
CREATE INDEX "assets_snapshot_node_idx" ON "assets" USING btree ("snapshotId","nodeId");--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_snapshot_figma_unique" ON "nodes" USING btree ("snapshotId","figmaNodeId");--> statement-breakpoint
CREATE INDEX "nodes_snapshot_idx" ON "nodes" USING btree ("snapshotId");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_source_unique" ON "projects" USING btree ("name","source");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_project_version_unique" ON "snapshots" USING btree ("projectId","version");--> statement-breakpoint
CREATE INDEX "snapshot_ready_idx" ON "snapshots" USING btree ("projectId","status","createdAt");