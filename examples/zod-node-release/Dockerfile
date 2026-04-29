FROM node:24-bookworm

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/zod-node-release/package.json examples/zod-node-release/tsconfig.json ./examples/zod-node-release/
COPY examples/zod-node-release/src ./examples/zod-node-release/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build

RUN output=$(RELEASE_DEPLOY_REGION=us-west-2 node examples/zod-node-release/src/index.ts deploy production --image=ghcr.io/acme/web --replicas=4) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "Deploying ghcr.io/acme/web to production profile=prod region=us-west-2 replicas=4 dryRun=false"

RUN completion=$(node examples/zod-node-release/src/index.ts completion zsh) \
  && printf '%s\n' "$completion" | grep -F '"program": "release"' \
  && printf '%s\n' "$completion" | grep -F '"shell": "zsh"'