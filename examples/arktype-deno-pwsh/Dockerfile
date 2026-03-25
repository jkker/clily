FROM node:24-bookworm

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/tests ./packages/core/tests
COPY examples/arktype-deno-pwsh/package.json examples/arktype-deno-pwsh/tsconfig.json examples/arktype-deno-pwsh/deno.json ./examples/arktype-deno-pwsh/
COPY examples/arktype-deno-pwsh/src ./examples/arktype-deno-pwsh/src

RUN pnpm install --frozen-lockfile
RUN cd packages/core && pnpm run build
RUN apt-get update >/dev/null \
  && apt-get install -y --no-install-recommends curl unzip gpg >/dev/null \
  && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor >/usr/share/keyrings/microsoft.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" >/etc/apt/sources.list.d/microsoft-prod.list \
  && apt-get update >/dev/null \
  && apt-get install -y --no-install-recommends powershell >/dev/null \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh >/dev/null

ENV PATH="/usr/local/bin:${PATH}"

RUN output=$(deno run -A --config examples/arktype-deno-pwsh/deno.json examples/arktype-deno-pwsh/src/index.ts) \
  && printf '%s\n' "$output" \
  && printf '%s\n' "$output" | grep -F "Rolling out revision=rev-42 replicas=3 region=eu-west-1 verbose=true"

RUN pwsh -NoLogo -Command "deno run -A --config examples/arktype-deno-pwsh/deno.json examples/arktype-deno-pwsh/src/index.ts completion pwsh" >/tmp/pwsh-completion.txt \
  && grep -F "Register-ArgumentCompleter" /tmp/pwsh-completion.txt