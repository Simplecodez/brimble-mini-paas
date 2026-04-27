FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    git \
    g++ \
    make \
    python3 \
    tar \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo \
    "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y docker-ce-cli \
  && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin

WORKDIR /app

COPY apps/api/package.json ./
COPY apps/api/tsconfig.json ./
RUN npm install

COPY apps/api/src ./src
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]