FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/plugin/package.json apps/plugin/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile --production

COPY apps/api apps/api
COPY packages/shared packages/shared

ENV PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["sh", "-c", "bun apps/api/src/db/migrate.ts && exec bun apps/api/src/main.ts"]
