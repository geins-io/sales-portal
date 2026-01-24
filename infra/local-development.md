# Local Development Setup

This guide explains how to set up your local environment for multi-tenant development using wildcard domains.

## Overview

For testing multi-tenancy locally, we use:

- **dnsmasq** - DNS server that supports wildcard domains
- **pfctl** - macOS port forwarding (port 80 → 3000)

This allows you to access the app via URLs like:

- `http://tenant1.litium.portal/`
- `http://demo.litium.portal/`
- `http://anything.litium.portal/`

Each unique hostname will auto-create a tenant configuration.

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
echo "address=/litium.portal/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf
```

> **Note:** This resolves `*.litium.portal` to `127.0.0.1`

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
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/litium.portal
```

## Step 5: Flush DNS Cache

```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

## Step 6: Test DNS Resolution

```bash
ping -c 1 test.litium.portal
```

Should show:

```
PING test.litium.portal (127.0.0.1): 56 data bytes
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

### 1. Configure Environment

Make sure your `.env` file has:

```bash
# Bind to all interfaces (required for custom domains)
HOST=0.0.0.0

# Auto-create tenants for unknown hostnames
NUXT_AUTO_CREATE_TENANT=true
```

### 2. Start the Server

```bash
pnpm dev
```

### 3. Access in Browser

With port forwarding:

- `http://test.litium.portal/`
- `http://demo.litium.portal/`

Without port forwarding:

- `http://test.litium.portal:3000/`
- `http://demo.litium.portal:3000/`

---

## Quick Start Commands

Run these once to set everything up:

```bash
# Install and configure dnsmasq
brew install dnsmasq
echo "address=/litium.portal/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf
sudo brew services start dnsmasq

# Configure macOS resolver
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/litium.portal

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
   cat /etc/resolver/litium.portal
   ```

3. Test DNS directly:

   ```bash
   dig test.litium.portal @127.0.0.1 +short
   ```

4. Flush DNS cache:
   ```bash
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   ```

### Connection refused

1. Check dev server is running on correct interface:

   ```bash
   lsof -i :3000
   ```

   Should show `*:hbci` (all interfaces), not `localhost:hbci`

2. Make sure `HOST=0.0.0.0` is in your `.env`

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
- Add a trailing slash: `http://test.litium.portal/`
- Use Firefox or Safari which handle custom TLDs better

---

## Cleanup

To completely remove the local development DNS setup:

```bash
# Stop dnsmasq
sudo brew services stop dnsmasq

# Remove resolver
sudo rm /etc/resolver/litium.portal

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
