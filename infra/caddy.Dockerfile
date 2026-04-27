FROM node:20-bookworm-slim AS web-build

WORKDIR /app/apps/web
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
RUN npm run build

FROM caddy:2.10.2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv

