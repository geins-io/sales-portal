#!/usr/bin/env bash
# Generates a self-signed TLS certificate for *.litium.portal so the production
# build can be served over https under test (`pnpm preview` with
# NITRO_SSL_CERT / NITRO_SSL_KEY, wired up by playwright.config.ts).
#
# Why: the production build sets `upgrade-insecure-requests` in its CSP and
# marks auth cookies Secure. Over plain http the browser rewrites every
# /_nuxt/* request to https (nothing answers, no JavaScript loads) and drops
# the session cookie. Serving TLS makes the tested build identical to the
# shipped one. The dev server (`pnpm dev`) has neither behaviour and stays http.
#
# Plain openssl, no admin password, nothing installed in a trust store — the
# Playwright browsers accept the cert via ignoreHTTPSErrors. Run
# `mkcert -install` separately only if you want to browse the local production
# build without a warning.
#
# Usage: infra/scripts/local-cert.sh [out-dir]   (default: .certs)
# Idempotent: exits 0 without touching an existing, unexpired pair.

set -euo pipefail

DOMAIN="litium.portal"
OUT_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.certs}"
CERT="$OUT_DIR/local.crt"
KEY="$OUT_DIR/local.key"

if [[ -f "$CERT" && -f "$KEY" ]] && openssl x509 -checkend 86400 -noout -in "$CERT" >/dev/null 2>&1; then
  echo "TLS cert for *.$DOMAIN already present in $OUT_DIR"
  exit 0
fi

mkdir -p "$OUT_DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$KEY" -out "$CERT" \
  -subj "/CN=*.$DOMAIN" \
  -addext "subjectAltName=DNS:*.$DOMAIN,DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1" \
  >/dev/null
chmod 600 "$KEY"
echo "Generated self-signed TLS cert for *.$DOMAIN in $OUT_DIR"
