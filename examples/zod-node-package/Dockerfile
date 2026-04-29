FROM node:24-bookworm AS deps

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/zod-node-package/package.json examples/zod-node-package/tsconfig.json ./examples/zod-node-package/
COPY examples/zod-node-package/src ./examples/zod-node-package/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build

FROM node:24-bookworm

WORKDIR /workspace

COPY --from=deps /workspace /workspace

RUN output=$(PACKAGECTL_PUBLISH_RETRIES=5 node examples/zod-node-package/src/index.ts publish --tag=next) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "[packagectl:success] Publishing tag=next registry=https://registry.example.test retries=5"

RUN completion=$(node examples/zod-node-package/src/index.ts completion bash) \
  && printf '%s\n' "$completion" | grep -F '"program": "packagectl"' \
  && printf '%s\n' "$completion" | grep -F '"shell": "bash"'