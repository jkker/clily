FROM node:24-bookworm

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/zod-node-maintenance/package.json examples/zod-node-maintenance/tsconfig.json ./examples/zod-node-maintenance/
COPY examples/zod-node-maintenance/src ./examples/zod-node-maintenance/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build

RUN output=$(node examples/zod-node-maintenance/src/index.ts backup db uploads --no-compress) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "[plugin:setup] backup" \
  && printf '%s\n' "$output" | grep -F "Backing up db,uploads snapshot=nightly compress=false" \
  && printf '%s\n' "$output" | grep -F "[plugin:cleanup] backup"

RUN completion=$(node examples/zod-node-maintenance/src/index.ts completion fish) \
  && printf '%s\n' "$completion" | grep -F '"program": "maintenance"' \
  && printf '%s\n' "$completion" | grep -F '"shell": "fish"'
