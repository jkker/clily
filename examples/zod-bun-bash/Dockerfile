FROM node:24-bookworm AS deps

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/zod-bun-bash/package.json examples/zod-bun-bash/tsconfig.json examples/zod-bun-bash/bunfig.toml ./examples/zod-bun-bash/
COPY examples/zod-bun-bash/src ./examples/zod-bun-bash/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build

FROM oven/bun:1

WORKDIR /workspace

COPY --from=deps /workspace /workspace

RUN output=$(bun run examples/zod-bun-bash/src/index.ts build --format=cjs --minify=false --registry=https://registry.example.test) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "Building format=cjs minify=false registry=https://registry.example.test verbose=false"

RUN completion=$(bun run examples/zod-bun-bash/src/index.ts completion bash) \
  && printf '%s\n' "$completion" | grep -F "complete -F _bundle-bun_completion bundle-bun"