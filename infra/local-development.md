# Local Development Setup

This guide explains how to set up your local environment for multi-tenant development using wildcard domains.

## Overview

For testing multi-tenancy locally, we use:

- **dnsmasq** - DNS server that supports wildcard domains
- **pfctl** - macOS port forwarding (port 80 → 3000)

This allows you to access the app via URLs like:

- `http://<name>.litium.test/` — any tenant registered in the merchant API, by name

Only hostnames registered in the merchant API resolve; any other name answers 404, locally as in
production. A `<name>.litium.test` host is looked up as `<name>.litium.store`
(`server/utils/lookup-hostname.ts`), which is where a tenant lives by default — so no per-tenant
configuration is needed, and the production build behaves the same way under test. See
[docs/testing.md](../docs/testing.md) for the e2e target.

---

## Prerequisites

- macOS (this guide is macOS-specific)
- [Homebrew](https://brew.sh/) installed
- Admin (sudo) access

---

## Step 1: Install dnsmasq

```bash
brew install dnsmasq
```

## Step 2: Configure Wildcard Domain

Add the wildcard rule to dnsmasq config:

```bash
echo "address=/litium.test/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf
```

> **Note:** This resolves `*.litium.test` to `127.0.0.1`

## Step 3: Start dnsmasq

```bash
sudo brew services start dnsmasq
```

To check status:

```bash
brew services list | grep dnsmasq
```

## Step 4: Configure macOS Resolver

Create the resolver directory and file:

```bash
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/litium.test
```

> **Note:** A machine configured under an earlier suffix keeps its old
> `address=/…/127.0.0.1` line and `/etc/resolver/` file. Both are harmless — such a name still
> resolves to loopback, but the server no longer rewrites it, so it answers 404 — and
> `pnpm local:setup` adds the new entries beside them rather than replacing them.

## Step 5: Flush DNS Cache

```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

## Step 6: Test DNS Resolution

```bash
ping -c 1 probe.litium.test
```

Should show:

```
PING probe.litium.test (127.0.0.1): 56 data bytes
```

---

## Port Forwarding (Optional)

By default, Nuxt runs on port 3000. To access without specifying the port, set up port forwarding.

### Enable Port Forwarding

Create the port forwarding rule:

```bash
sudo tee /etc/pf.anchors/dev.local << 'EOF'
rdr pass inet proto tcp from any to any port 80 -> 127.0.0.1 port 3000
EOF
```

Enable it:

```bash
sudo pfctl -ef /etc/pf.anchors/dev.local
```

> **Note:** The warnings about ALTQ are normal and can be ignored.

### Disable Port Forwarding

When you're done:

```bash
sudo pfctl -d
```

### Re-enable Port Forwarding

After a reboot or if disabled:

```bash
sudo pfctl -ef /etc/pf.anchors/dev.local
```

---

## Running the Dev Server

### 1. Start the Server

```bash
pnpm local:dev
```

The dev server binds `127.0.0.1`. It holds the resolved tenant's Geins storefront key in memory,
so it is not served to the network by default; dnsmasq and the pf rule both point at `127.0.0.1`,
so the wildcard domains work over loopback. Do not set `HOST` in `.env` — `pnpm local:dev` passes
it explicitly.

To reach the dev server from another device on the network — a phone, a tablet — opt in per run:

```bash
pnpm local:dev --lan
```

### 2. Access in Browser

With port forwarding:

- `http://example.litium.test/`

Without port forwarding:

- `http://example.litium.test:3000/`

---

## Quick Start Commands

Run these once to set everything up:

```bash
# Install and configure dnsmasq
brew install dnsmasq
echo "address=/litium.test/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf
sudo brew services start dnsmasq

# Configure macOS resolver
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/litium.test

# Set up port forwarding (optional)
sudo tee /etc/pf.anchors/dev.local << 'EOF'
rdr pass inet proto tcp from any to any port 80 -> 127.0.0.1 port 3000
EOF
sudo pfctl -ef /etc/pf.anchors/dev.local

# Flush DNS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

---

## Troubleshooting

### DNS not resolving

1. Check dnsmasq is running:

   ```bash
   brew services list | grep dnsmasq
   ```

2. Check resolver file exists:

   ```bash
   cat /etc/resolver/litium.test
   ```

3. Test DNS directly:

   ```bash
   dig probe.litium.test @127.0.0.1 +short
   ```

4. Flush DNS cache:
   ```bash
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   ```

### Connection refused

1. Check the dev server is listening:

   ```bash
   lsof -iTCP:3000 -sTCP:LISTEN
   ```

   Should show `localhost:hbci`, or `*:hbci` after `pnpm local:dev --lan`.

2. From another device on the network, `localhost:hbci` is the answer: restart with
   `pnpm local:dev --lan`.

### Port 80 not working

1. Check port forwarding is enabled:

   ```bash
   sudo pfctl -s rules | grep 3000
   ```

2. Re-enable if needed:
   ```bash
   sudo pfctl -ef /etc/pf.anchors/dev.local
   ```

### Browser shows search results instead of site

Some browsers (especially Chrome) interpret custom TLDs as search queries.

Solutions:

- Always include `http://` in the URL
- Add a trailing slash: `http://example.litium.test/`
- Use Firefox or Safari which handle custom TLDs better

---

## Cleanup

To completely remove the local development DNS setup:

```bash
# Stop dnsmasq
sudo brew services stop dnsmasq

# Remove resolver
sudo rm /etc/resolver/litium.test

# Disable port forwarding
sudo pfctl -d

# (Optional) Uninstall dnsmasq
brew uninstall dnsmasq

# Flush DNS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

---

## Adding More Domains

To add additional wildcard domains (e.g., `*.mycompany.local`):

1. Add to dnsmasq config:

   ```bash
   echo "address=/mycompany.local/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf
   ```

2. Create resolver file:

   ```bash
   echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/mycompany.local
   ```

3. Restart dnsmasq:

   ```bash
   sudo brew services restart dnsmasq
   ```

4. Flush DNS:
   ```bash
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   ```
