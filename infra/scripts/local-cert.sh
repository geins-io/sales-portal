#!/usr/bin/env bash
# Generates a self-signed TLS certificate for *.litium.portal and
# *.litium.store so the production build can be served over https under test
# (`pnpm preview` with NITRO_SSL_CERT / NITRO_SSL_KEY, wired up by
# playwright.config.ts). Both suffixes: the dev server is reached under
# .litium.portal, the production build under the tenant's registered
# .litium.store hostname.
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
STORE_DOMAIN="litium.store"
OUT_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.certs}"
CERT="$OUT_DIR/local.crt"
KEY="$OUT_DIR/local.key"
SAN="DNS:*.$DOMAIN,DNS:$DOMAIN,DNS:*.$STORE_DOMAIN,DNS:$STORE_DOMAIN,DNS:localhost,IP:127.0.0.1"

# Unexpired is not enough: a cert generated before *.litium.store joined the
# SAN would keep the production-build target off the certificate.
if [[ -f "$CERT" && -f "$KEY" ]] &&
  openssl x509 -checkend 86400 -noout -in "$CERT" >/dev/null 2>&1 &&
  openssl x509 -noout -ext subjectAltName -in "$CERT" 2>/dev/null | grep -q "DNS:\*.$STORE_DOMAIN"; then
  echo "TLS cert for *.$DOMAIN and *.$STORE_DOMAIN already present in $OUT_DIR"
  exit 0
fi

mkdir -p "$OUT_DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$KEY" -out "$CERT" \
  -subj "/CN=*.$DOMAIN" \
  -addext "subjectAltName=$SAN" \
  >/dev/null
chmod 600 "$KEY"
echo "Generated self-signed TLS cert for *.$DOMAIN and *.$STORE_DOMAIN in $OUT_DIR"
