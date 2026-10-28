#!/bin/sh
# Writes config.json from env vars at container start (read by AppConfigService).
# Empty values are ignored by the app, so unset vars keep the build-time defaults.
#   API_URL  e.g. https://gobike.runasp.net/api/v1
#   HUB_URL  e.g. https://gobike.runasp.net/hubs/dashboard
set -eu

CONFIG=/usr/share/nginx/html/config.json

printf '{\n  "apiUrl": "%s",\n  "hubUrl": "%s"\n}\n' "${API_URL:-}" "${HUB_URL:-}" > "$CONFIG"
echo "runtime-config: apiUrl=${API_URL:-<default>} hubUrl=${HUB_URL:-<default>}"
