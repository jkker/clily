FROM node:24-bookworm

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/valibot-node-zsh/package.json examples/valibot-node-zsh/tsconfig.json ./examples/valibot-node-zsh/
COPY examples/valibot-node-zsh/src ./examples/valibot-node-zsh/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build
RUN apt-get update >/dev/null && apt-get install -y --no-install-recommends zsh >/dev/null

RUN output=$(node --experimental-strip-types examples/valibot-node-zsh/src/index.ts deploy --api-key=sk_demo --replicas=4 --profile=prod) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "Deploying 4 replicas to us-east-1 (prod) with key sk_demo. dryRun=false"

RUN completion=$(zsh -lc "node --experimental-strip-types examples/valibot-node-zsh/src/index.ts completion zsh") \
  && printf '%s\n' "$completion" | grep -F "compdef _release-node_completion release-node"