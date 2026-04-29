FROM node:24-bookworm

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/arktype-node-rollout/package.json examples/arktype-node-rollout/tsconfig.json ./examples/arktype-node-rollout/
COPY examples/arktype-node-rollout/src ./examples/arktype-node-rollout/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build

RUN output=$(node examples/arktype-node-rollout/src/index.ts ship production --revision=rev-42 --replicas=3 --strategy=blue-green) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "[plugin:setup] apply" \
  && printf '%s\n' "$output" | grep -F "Applying revision=rev-42 strategy=blue-green replicas=3 environment=production" \
  && printf '%s\n' "$output" | grep -F "[plugin:cleanup] apply"

RUN completion=$(node examples/arktype-node-rollout/src/index.ts completion pwsh) \
  && printf '%s\n' "$completion" | grep -F '"program": "rollout"' \
  && printf '%s\n' "$completion" | grep -F '"shell": "pwsh"'