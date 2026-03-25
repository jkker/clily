FROM node:24-bookworm

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/valibot-node-fish-runtime/package.json examples/valibot-node-fish-runtime/tsconfig.json ./examples/valibot-node-fish-runtime/
COPY examples/valibot-node-fish-runtime/src ./examples/valibot-node-fish-runtime/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build
RUN apt-get update >/dev/null && apt-get install -y --no-install-recommends fish >/dev/null

RUN output=$(node --experimental-strip-types examples/valibot-node-fish-runtime/src/index.ts completion fish) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "capturedStdout" \
  && printf '%s\n' "$output" | grep -F "complete -f -c backup-fish"