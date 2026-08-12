<p align="center">
  <a href="https://vantalogics.com">
    <img src="docs/assets/vantalogics-logo-black.png" alt="Vantalogics" width="180">
  </a>
</p>

# Figma Mirror MCP

> A free, local-first developer tool by **[Vantalogics](https://vantalogics.com)**.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Figma plan](https://img.shields.io/badge/Figma-Starter-000000.svg)](#no-paid-figma-requirement)
[![Runtime](https://img.shields.io/badge/runtime-Bun-f9f1e1.svg)](https://bun.sh)

Figma Mirror turns a design into an immutable local snapshot that coding agents can inspect repeatedly:

```text
Figma Design → classic plugin → local API/PostgreSQL/files → MCP → coding agent
```

Figma is only the source. Once exported, Codex CLI, Claude Code, and other MCP clients read the local mirror without contacting Figma again.

Figma Mirror MCP is part of **[Vantalogics Free Products](https://vantalogics.com)**: practical developer tools released at no cost, with source code available under a permissive license. It is not affiliated with or endorsed by Figma.

## No paid Figma requirement

The normal workflow is supported on **Figma Starter** with a standard classic Figma Design plugin. Figma Mirror does not require Dev Mode, a Full or Dev seat, Figma's MCP quota, OAuth, a personal access token, or the Figma REST API.

The plugin can only read what Figma exposes to the current user. If a source file is view-only, use Figma's **Duplicate to your Drafts** action when its copying permissions allow it, then run Figma Mirror from that editable copy. If copying is disabled by the owner, Figma Mirror respects that restriction. Upgrading Figma is not the expected workaround.

## Architecture

- `apps/plugin`: classic Figma plugin. Reads the open Design document through the Plugin API, exports real PNG/SVG/raster bytes, and uploads multipart data.
- `apps/api`: Elysia/Bun API. Validates snapshot schema, versions snapshots, stores searchable metadata with Drizzle/PostgreSQL, and puts heavy files in `DATA_DIR`.
- `apps/mcp`: local stdio MCP server. Returns bounded, AI-friendly views and native image content without accessing Figma.
- `packages/shared`: versioned snapshot schema, tree queries, inferred token extraction, and the future visual-comparison interface.

Snapshots are immutable. Each export creates `v1`, `v2`, and so on. Only `READY` snapshots are visible to MCP; failed or interrupted exports remain non-readable as design sources.

## Do I need to deploy it?

**No. The normal workflow does not require a deployment.** Everything runs on the same computer as Figma and the coding agent:

```text
While exporting
Figma plugin ──localhost──▶ API ──▶ PostgreSQL + DATA_DIR

While implementing
Codex / Claude ──stdio──▶ MCP ──localhost──▶ API
```

Keep PostgreSQL and the API running while exporting or querying snapshots. Figma only needs to be open during export; after a snapshot reaches `READY`, the design can be read repeatedly without Figma.

A deployment is optional and outside the MVP. It would only be useful if the API/database/storage must be shared across machines. The default plugin manifest deliberately permits only the local development endpoint.

## Figma Desktop is required

The current supported workflow uses **Figma Desktop for macOS or Windows**. Figma web cannot import this repository's local development manifest, so it is not supported for exporting snapshots in the MVP.

This does **not** require a paid Figma plan or Dev Mode. Figma Desktop with a Starter account and an editable Figma Design file is sufficient. The API, PostgreSQL, storage, and MCP remain local; nothing needs to be deployed.

## Quick start

### 1. Install and start

Clone the repository and start the local stack:

```bash
git clone https://github.com/vantalogics/figma-mirror-mcp.git
cd figma-mirror-mcp
bun install
bun run build:plugin
bun run docker:up
```

Docker Compose starts PostgreSQL and the API at `http://localhost:3000`, applies migrations, and keeps snapshot files in `data/`. It does not use or modify PostgreSQL installations already present on your computer.

Useful lifecycle commands:

| Action | Command |
| --- | --- |
| Start or update | `bun run docker:up` |
| Check status | `docker compose ps` |
| Follow API logs | `bun run docker:logs` |
| Stop | `bun run docker:down` |

Stopping preserves snapshots and database data. To deliberately delete the Docker database, use `docker compose down --volumes`.

Optional health check:

```bash
bun -e 'console.log(await fetch("http://localhost:3000/health").then(r => r.json()))'
```

### 2. Import the plugin into Figma Desktop

This is required only once per local clone:

1. Open an editable Figma Design file in **Figma Desktop**.
2. Press `Cmd/Ctrl + K` to open **Actions**.
3. Search for **Import new plugin from manifest**.
4. Select `apps/plugin/manifest.json` inside the cloned repository.

The browser editor cannot import a local manifest. This classic development plugin works with Figma Starter and does not require Dev Mode.

### 3. Export a frame

1. Select one concrete frame in the canvas or Layers panel.
2. Press `Cmd/Ctrl + K`, search for **Figma Mirror**, and run it.
3. Confirm that the plugin shows `API · Connected` and the expected selection name.
4. Keep screenshot scale at `2×` and click **Export Selection**.
5. Wait for the node count, asset count, screenshot confirmation, and snapshot version.

Every export creates a new immutable version. If the source is view-only, duplicate it to Drafts first when its copying permissions allow it.

### 4. Connect Claude Code or Codex CLI

Run the configuration command from the Figma Mirror repository root. `REPO_PATH="$(pwd)"` captures its absolute path for you.

| Client | Configuration scope | Verify |
| --- | --- | --- |
| Claude Code | User, available across local projects | `claude mcp get figma-mirror` or `/mcp` |
| Codex CLI | User configuration | `codex mcp list` |

#### Claude Code

```bash
REPO_PATH="$(pwd)"

claude mcp add \
  --transport stdio \
  --scope user \
  figma-mirror \
  -e FIGMA_MIRROR_API_URL=http://localhost:3000 \
  -e DATA_DIR="$REPO_PATH/data" \
  -- bun run --cwd "$REPO_PATH" dev:mcp

claude mcp get figma-mirror
```

#### Codex CLI

```bash
REPO_PATH="$(pwd)"

codex mcp add figma-mirror \
  --env FIGMA_MIRROR_API_URL=http://localhost:3000 \
  --env DATA_DIR="$REPO_PATH/data" \
  -- bun run --cwd "$REPO_PATH" dev:mcp

codex mcp list
```

The coding client launches the MCP stdio process when needed. Do not run `bun run dev:mcp` separately. Keep the Docker stack running while the agent reads snapshots; Figma itself can be closed after export.

### 5. Ask the agent to inspect and implement

Start with a read-only discovery prompt:

```text
Use the Figma Mirror MCP tools.

1. Run list_projects and find the relevant project.
2. Get its latest READY snapshot.
3. Run list_frames and identify the frame I just exported.
4. Inspect it with inspect_design and examine the original screenshot.

Tell me which project, snapshot version, and frame you found. Do not implement anything yet.
```

Then run the coding agent inside the project that should receive the implementation and use:

```text
Implement the design you inspected with Figma Mirror in this project.

Treat the original Figma screenshot as the visual source of truth. Match the dimensions, structure, layout, spacing, alignment, typography, colors, effects, components, and original assets as closely as possible.

Use get_node, get_frame, get_component, get_asset, or get_screenshot whenever you need more detail. Follow the existing stack and conventions of this repository, run the application, and verify the result before finishing.
```

## Requirements

- Bun 1.3 or newer
- Docker Desktop or another Docker Engine with Compose (recommended)
- PostgreSQL only when choosing the native setup
- Figma desktop app to import the local development plugin

Docker is optional; it is the easiest way to avoid local PostgreSQL users, passwords, and port conflicts.

## Native setup without Docker

If you already manage PostgreSQL locally, copy `.env.example`, set `DATABASE_URL` to a role whose password you know, create the database with that role, then migrate and start development:

```bash
bun install
cp .env.example .env
createdb --host=localhost --username=<POSTGRES_USER> figma_mirror
bun run db:migrate
bun run dev
```

An error such as `password authentication failed for user "<name>"` means the local PostgreSQL server rejected that database role's password. It is unrelated to the operating-system password and to Figma Mirror. Use a known PostgreSQL role or the recommended Docker path.

## Development

The quick start above is sufficient for normal use. These additional commands are useful while developing Figma Mirror itself.

The default API is `http://localhost:3000`. Override `PORT`, `DATABASE_URL`, `DATA_DIR`, or `FIGMA_MIRROR_API_URL` in `.env`.

Useful commands:

```bash
bun run dev:api
bun run dev:plugin
bun run dev:mcp
bun run build:plugin
bun run docker:up
bun run docker:down
bun run docker:logs
bun run typecheck
bun test
bun run build
bun run db:generate
bun run db:migrate
```

`bun run dev` starts the API and watches the plugin build. The MCP server is normally launched on demand by its client because stdio owns standard input/output.

## Snapshot export details

The plugin serializes only the selected subtree, renders the authoritative PNG directly in Figma, uploads assets separately from JSON, and reports node/asset counts. **Export Current Page** mirrors visible top-level page content; hidden nodes are opt-in.

The plugin captures normalized geometry, Auto Layout, fills/strokes/gradients, effects, mixed-style text runs, variable bindings and local collections, components/sets/instances, vector SVG, image bytes, paths, and warnings. Unsupported properties are omitted—not invented.

## MCP tools

- `list_projects`, `list_snapshots`, `get_latest_snapshot`, `list_pages`
- `list_frames`, `search_nodes`, `get_node`, `get_frame`
- `get_design_tokens`, `get_component`, `get_asset`, `get_screenshot`
- `inspect_design`: resolves a node id, frame name, or component name and returns the original screenshot plus compact structure, layout, typography, colors, components, assets, and declared/inferred tokens.

A typical agent workflow is:

```text
list_projects → get_latest_snapshot → inspect_design("Dashboard / Desktop")
```

`get_node` defaults to one descendant level and `get_frame` defaults to two. This keeps context small. `get_screenshot` and `inspect_design` return MCP `image` content when the client supports it and also expose an absolute local path.

## API upload protocol

`POST /snapshots` accepts one multipart request:

- `manifest`: JSON conforming to `snapshotVersion: 1`;
- `file:<asset-id>`: one binary part per declared asset/screenshot.

The API creates a `CREATING` record, validates every required part and SHA-256 hashes bytes server-side, moves staged files into `DATA_DIR/<snapshot-id>`, writes nodes/assets transactionally, then marks the version `READY`. Errors mark it `FAILED`.

Read endpoints include `/health`, `/projects`, `/snapshots`, `/projects/:id/latest`, bounded node/search routes, asset metadata, and screenshot bytes.

## Storage

PostgreSQL stores projects, immutable version metadata, normalized searchable nodes, and asset metadata. JSONB keeps detailed node data without exploding the schema into many tables. Large bytes live under:

```text
data/<snapshot-id>/assets/sha256-<hash>.<ext>
data/<snapshot-id>/screenshots/<frame-name>.png
```

`FileSystemStorage` is a small boundary that can later be replaced by S3/R2 without changing snapshot logic. Declared Figma variables remain separate from inferred frequent colors, sizes, radii, and spacing.

## Limitations

- Figma must be open only while creating or refreshing a snapshot. Reading it is entirely local afterward.
- The automated suite uses small simulated trees; final plugin behavior still requires a manual run inside Figma because the Plugin API runtime is proprietary.
- Image fills are preserved as original bytes when Figma exposes them, but the source mime type is not provided by this Plugin API surface, so unknown rasters use `.bin`/`application/octet-stream` metadata.
- Remote library intent can be limited by what Figma exposes to the plugin. Resolved instance visuals and subtree data remain in the snapshot.
- Partial first-level screenshots, full visual diffing, and autonomous correction are intentionally deferred. The `VisualComparisonProvider` interface reserves the future comparison boundary.

## Design goal

The screenshot is the visual truth. Structured data explains how to reproduce it. The success metric is whether a coding agent can implement a frame with near pixel-level fidelity without another Figma request—not the raw number of properties exported.

## License

Figma Mirror MCP is a free and open-source product from **[Vantalogics](https://vantalogics.com)**, released under the [MIT License](LICENSE).

You may use, copy, modify, distribute, and include it in commercial projects, provided the copyright and license notice are retained. The software is provided without warranty. The [Vantalogics](https://vantalogics.com) name and logo identify the project publisher; the MIT License does not grant trademark rights.
