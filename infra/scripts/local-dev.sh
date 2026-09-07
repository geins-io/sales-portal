#!/bin/bash

# Local Development Script for Multi-Tenant Setup
# --setup installs dnsmasq, the resolver and the local cert; --start adds port
# forwarding for as long as it runs and removes it again on exit.
# See infra/local-development.md for full documentation

set -e

DOMAIN="litium.test"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DNSMASQ_CONF="/opt/homebrew/etc/dnsmasq.conf"
RESOLVER_FILE="/etc/resolver/$DOMAIN"
PF_ANCHOR="/etc/pf.anchors/dev.local"

# The rule is loaded into its own anchor rather than as the main ruleset.
# /etc/pf.conf states that the main ruleset must not be flushed, because the
# nested anchors the system relies on are defined there. It has to live under
# `com.apple/` because that file references only `com.apple/*`: an anchor at
# the root would load and never be evaluated.
PF_ANCHOR_NAME="com.apple/dev.local"

# Set once the forwarding is ours to remove. The token is pf's enable
# reference; releasing it leaves pf running for anything else that enabled it.
PF_TOKEN=""
PF_FORWARDING_OURS="false"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on macOS
check_macos() {
    if [[ "$(uname)" != "Darwin" ]]; then
        print_error "This script only works on macOS"
        exit 1
    fi
}

# Check if Homebrew is installed
check_homebrew() {
    if ! command -v brew &> /dev/null; then
        print_error "Homebrew is not installed. Please install it first: https://brew.sh/"
        exit 1
    fi
}

# Check if dnsmasq is installed
check_dnsmasq_installed() {
    if ! brew list dnsmasq &> /dev/null; then
        return 1
    fi
    return 0
}

# Install dnsmasq
install_dnsmasq() {
    print_status "Installing dnsmasq..."
    brew install dnsmasq
    print_success "dnsmasq installed"
}

# Configure dnsmasq for wildcard domain
configure_dnsmasq() {
    if grep -q "address=/$DOMAIN/" "$DNSMASQ_CONF" 2>/dev/null; then
        print_success "dnsmasq already configured for *.$DOMAIN"
        return 0
    fi

    print_status "Configuring dnsmasq for *.$DOMAIN..."
    echo "address=/$DOMAIN/127.0.0.1" >> "$DNSMASQ_CONF"
    print_success "dnsmasq configured"
}

# Configure macOS resolver
configure_resolver() {
    if [[ -f "$RESOLVER_FILE" ]]; then
        print_success "Resolver already configured for $DOMAIN"
        return 0
    fi

    print_status "Configuring macOS resolver for $DOMAIN..."
    sudo mkdir -p /etc/resolver
    echo "nameserver 127.0.0.1" | sudo tee "$RESOLVER_FILE" > /dev/null
    print_success "Resolver configured"
}

# The hostname the e2e suite targets, from the suite's own source (its
# committed default, or PLAYWRIGHT_BASE_URL in .env).
e2e_target_host() {
    (cd "$REPO_ROOT" && node tests/e2e/target-defaults.mjs 2>/dev/null)
}

# Start dnsmasq service
start_dnsmasq() {
    if brew services list | grep -q "dnsmasq.*started"; then
        print_success "dnsmasq is already running"
        return 0
    fi

    print_status "Starting dnsmasq service..."
    sudo brew services start dnsmasq
    print_success "dnsmasq started"
}

# pfctl on macOS warns about missing ALTQ support on every invocation. Drop
# those lines and nothing else, so a real error is still seen, and keep the
# exit status the caller needs.
pfctl_quiet() {
    local output status=0
    output="$(sudo pfctl "$@" 2>&1)" || status=$?
    printf '%s\n' "$output" | grep -v -i 'altq' | grep -v '^[[:space:]]*$' || true
    return $status
}

# Whether our anchor currently holds the redirect. Pass -n to ask without a
# password prompt. `rdr` rules are listed by `-s nat`; `-s rules` shows filter
# rules only, so the check this replaces could never see the rule.
pf_forwarding_active() {
    sudo "$@" pfctl -a "$PF_ANCHOR_NAME" -s nat 2>/dev/null | grep -q "port 3000"
}

# Enable port forwarding (80 -> 3000) for the lifetime of this script.
enable_port_forwarding() {
    if [[ ! -f "$PF_ANCHOR" ]]; then
        print_status "Creating port forwarding rule..."
        sudo tee "$PF_ANCHOR" > /dev/null << 'EOF'
rdr pass inet proto tcp from any to any port 80 -> 127.0.0.1 port 3000
EOF
    fi

    print_status "Enabling port forwarding (80 -> 3000)..."
    # Loaded unconditionally: loading an anchor replaces its contents, so a
    # rule left behind by a killed session becomes ours and is removed on exit.
    pfctl_quiet -a "$PF_ANCHOR_NAME" -f "$PF_ANCHOR"
    PF_TOKEN="$(sudo pfctl -E 2>&1 | awk -F'[[:space:]]*:[[:space:]]*' '/Token/ { print $2 }')"

    PF_FORWARDING_OURS="true"
    # INT and TERM exit explicitly: a bash signal handler otherwise returns to
    # the line after the interrupted command, so Ctrl-C would fall through to
    # whatever follows the dev server. 128 + the signal number is what a shell
    # killed by that signal reports.
    trap disable_port_forwarding EXIT
    trap 'disable_port_forwarding; exit 130' INT
    trap 'disable_port_forwarding; exit 143' TERM
    print_success "Port forwarding enabled"
}

# Remove the forwarding this script enabled. Runs from the trap above, so it
# has to be safe to call twice: EXIT fires after INT as well.
disable_port_forwarding() {
    [[ "$PF_FORWARDING_OURS" == "true" ]] || return 0
    PF_FORWARDING_OURS="false"
    trap - EXIT INT TERM

    echo ""
    print_status "Removing port forwarding..."
    pfctl_quiet -a "$PF_ANCHOR_NAME" -F all || true
    # Only our own reference: pf stays on for anything else that enabled it.
    if [[ -n "$PF_TOKEN" ]]; then
        pfctl_quiet -X "$PF_TOKEN" || true
    fi
    print_success "Port forwarding removed"
    return 0
}

# Flush DNS cache
flush_dns() {
    print_status "Flushing DNS cache..."
    sudo dscacheutil -flushcache
    sudo killall -HUP mDNSResponder 2>/dev/null || true
    print_success "DNS cache flushed"
}

# Test DNS resolution, on the name the e2e suite itself will ask for. Report
# the address it actually resolves to: a target that answers from somewhere
# else is the failure preflight L0 exists to catch, and saying "-> 127.0.0.1"
# on any successful ping would hide exactly that.
test_dns() {
    local host address
    host="$(e2e_target_host || true)"
    host="${host:-wildcard-check.$DOMAIN}"

    print_status "Testing DNS resolution..."
    address="$(dscacheutil -q host -a name "$host" | awk '/^ip_address:/ { print $2; exit }')"

    if [[ -z "$address" ]]; then
        print_warning "$host does not resolve. You may need to wait a moment or restart your browser."
        return 1
    fi

    if [[ "$address" != "127.0.0.1" ]]; then
        print_warning "$host resolves to $address, not this machine — an e2e run against it would test whatever answers there (preflight L0 refuses to)."
        return 1
    fi

    print_success "DNS resolution working: $host -> $address"
    return 0
}

# Show usage
show_usage() {
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --setup       Run initial setup (install dnsmasq, configure resolver)"
    echo "  --start       Start services and dev server (default)"
    echo "  --stop        Remove a stray port forwarding rule (--start cleans up its own)"
    echo "  --status      Check status of all services"
    echo "  --no-pf       Skip port forwarding (use port 3000)"
    echo "  --lan         Bind the dev server to all interfaces (default: 127.0.0.1)"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --setup    # First-time setup"
    echo "  $0            # Start dev environment"
    echo "  $0 --no-pf    # Start without port forwarding"
    echo "  $0 --lan      # Also serve to other devices on the network"
    echo ""
}

# Check status of all services
check_status() {
    echo ""
    echo "=== Local Development Status ==="
    echo ""

    # Check dnsmasq
    if check_dnsmasq_installed; then
        if brew services list | grep -q "dnsmasq.*started"; then
            print_success "dnsmasq: installed and running"
        else
            print_warning "dnsmasq: installed but not running"
        fi
    else
        print_error "dnsmasq: not installed"
    fi

    # Check resolver
    if [[ -f "$RESOLVER_FILE" ]]; then
        print_success "Resolver: configured for $DOMAIN"
    else
        print_error "Resolver: not configured"
    fi

    # Check port forwarding. Reading pf needs root, but a status command that
    # blocks on a password prompt is worse than one that says it cannot tell.
    if ! sudo -n true 2>/dev/null; then
        print_warning "Port forwarding: unknown (run 'sudo -v', then this again)"
    elif pf_forwarding_active -n; then
        print_success "Port forwarding: enabled (80 -> 3000)"
    else
        print_warning "Port forwarding: disabled"
    fi

    # Test DNS
    echo ""
    test_dns
    echo ""
}

# Remove a forwarding rule left behind by a session that was killed before its
# own cleanup could run. `pnpm local:dev` removes its rule on exit, so in the
# normal flow there is nothing here to do.
stop_services() {
    print_status "Removing port forwarding..."
    # Our anchor only. A bare `pfctl -d` would switch pf off for every other
    # component that enabled it, which is what this used to do.
    pfctl_quiet -a "$PF_ANCHOR_NAME" -F all || true
    print_success "Port forwarding removed"
}

# Run initial setup
run_setup() {
    echo ""
    echo "=== Local Development Setup ==="
    echo ""

    check_macos
    check_homebrew

    if ! check_dnsmasq_installed; then
        install_dnsmasq
    else
        print_success "dnsmasq already installed"
    fi

    configure_dnsmasq
    configure_resolver
    start_dnsmasq
    flush_dns
    generate_local_cert

    echo ""
    test_dns
    echo ""
    print_success "Setup complete!"
    echo ""
    echo "You can now access the app at:"
    echo "  http://$(e2e_target_host):3000/   (the e2e target, after pnpm dev)"
    echo "  http://[any-registered-tenant].$DOMAIN:3000/"
    echo ""
    # Setup installs DNS and the cert and stops there. Port forwarding is a
    # property of a running dev session, not of the machine, so it belongs to
    # `pnpm local:dev` — which removes it again when it exits.
    echo "For the same URLs without :3000, use pnpm local:dev: it forwards"
    echo "port 80 to 3000 while it runs."
    echo ""
    echo "Production-build e2e (E2E_PROD=1 pnpm test:e2e) serves https with the"
    echo "self-signed cert in .certs/ — see infra/scripts/local-cert.sh."
    echo ""
}

# Self-signed TLS cert for serving the production build over https under test
generate_local_cert() {
    print_status "Generating local TLS cert for *.$DOMAIN..."
    "$(dirname "$0")/local-cert.sh"
}

# Start dev environment
start_dev() {
    local skip_pf=$1
    local bind_lan=$2

    echo ""
    echo "=== Starting Local Development ==="
    echo ""

    check_macos

    # Check if dnsmasq is set up
    if ! check_dnsmasq_installed; then
        print_error "dnsmasq is not installed. Run with --setup first."
        exit 1
    fi

    # Ensure dnsmasq is running
    start_dnsmasq

    # Setup port forwarding unless skipped
    if [[ "$skip_pf" != "true" ]]; then
        enable_port_forwarding
    else
        print_status "Skipping port forwarding (use port 3000)"
    fi

    # Flush DNS cache
    flush_dns

    echo ""
    
    # Test DNS
    test_dns

    echo ""
    local dev_host
    dev_host="$(e2e_target_host || true)"
    echo "Access the app at:"
    if [[ "$skip_pf" != "true" ]]; then
        echo "  http://${dev_host}/   (the e2e target)"
        echo "  http://[any-registered-tenant].$DOMAIN/"
    else
        echo "  http://${dev_host}:3000/   (the e2e target)"
        echo "  http://[any-registered-tenant].$DOMAIN:3000/"
    fi
    echo ""

    if [[ "$skip_pf" != "true" ]]; then
        print_status "Port forwarding is removed when this exits; macOS may ask"
        print_status "for your password again then."
        echo ""
        # Refreshes the sudo timestamp so the prompt on exit is less likely.
        sudo -v
    fi

    print_status "Starting Nuxt dev server..."
    echo ""

    # Loopback by default: the dev server holds the resolved tenant's Geins
    # key in memory. dnsmasq and the pf rule both point at 127.0.0.1, so
    # custom domains work either way.
    local bind_host="127.0.0.1"
    if [[ "$bind_lan" == "true" ]]; then
        bind_host="0.0.0.0"
        print_warning "Binding all interfaces — anything on the network can reach this server"
    fi

    HOST="$bind_host" pnpm nuxt dev
}

# Parse arguments
SKIP_PF="false"
BIND_LAN="false"
ACTION="start"

while [[ $# -gt 0 ]]; do
    case $1 in
        --setup)
            ACTION="setup"
            shift
            ;;
        --start)
            ACTION="start"
            shift
            ;;
        --stop)
            ACTION="stop"
            shift
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --no-pf)
            SKIP_PF="true"
            shift
            ;;
        --lan)
            BIND_LAN="true"
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Execute action
case $ACTION in
    setup)
        run_setup
        ;;
    start)
        start_dev "$SKIP_PF" "$BIND_LAN"
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
esac
