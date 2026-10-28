# ── Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts: skip the husky `prepare` hook (no .git in the image)
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Runtime settings (no rebuild needed per environment):
#   API_URL          → written to config.json, e.g. https://gobike.runasp.net/api/v1
#   HUB_URL          → written to config.json, e.g. https://gobike.runasp.net/hubs/dashboard
#   CSP_CONNECT_SRC  → origins the app may call. When the API is on another origin, list it
#                      for both protocols, e.g. "'self' https://gobike.runasp.net wss://gobike.runasp.net"
ENV API_URL="" \
    HUB_URL="" \
    CSP_CONNECT_SRC="'self' https://gobike.runasp.net wss://gobike.runasp.net"

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

COPY --from=build /app/dist/gobike-dashboard/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
