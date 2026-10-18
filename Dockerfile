# Runtime image of the MotoFlow frontend: the static files of `npm run build`, served by Caddy.
# CI builds dist/ first and builds this image from that same dist/, so there is no Node stage here.
# Local build: npm ci && npm run build && docker build -t motoflow-frontend .
FROM caddy:2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY dist/ /srv/

EXPOSE 80
