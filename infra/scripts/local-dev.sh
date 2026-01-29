#!/bin/bash

# Local Development Script for Multi-Tenant Setup
# This script sets up dnsmasq, port forwarding, and starts the dev server
# See infra/local-development.md for full documentation

set -e

DOMAIN="litium.portal"
DNSMASQ_CONF="/opt/homebrew/etc/dnsmasq.conf"
RESOLVER_FILE="/etc/resolver/$DOMAIN"
PF_ANCHOR="/etc/pf.anchors/dev.local"

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

# Setup port forwarding (80 -> 3000)
setup_port_forwarding() {
    # Create the pf anchor file if it doesn't exist
    if [[ ! -f "$PF_ANCHOR" ]]; then
        print_status "Creating port forwarding rule..."
        sudo tee "$PF_ANCHOR" > /dev/null << 'EOF'
rdr pass inet proto tcp from any to any port 80 -> 127.0.0.1 port 3000
EOF
    fi

    # Check if port forwarding is already enabled
    if sudo pfctl -s rules 2>/dev/null | grep -q "3000"; then
        print_success "Port forwarding (80 -> 3000) is already enabled"
        return 0
    fi

    print_status "Enabling port forwarding (80 -> 3000)..."
    sudo pfctl -ef "$PF_ANCHOR" 2>/dev/null || true
    print_success "Port forwarding enabled"
}

# Flush DNS cache
flush_dns() {
    print_status "Flushing DNS cache..."
    sudo dscacheutil -flushcache
    sudo killall -HUP mDNSResponder 2>/dev/null || true
    print_success "DNS cache flushed"
}

# Test DNS resolution
test_dns() {
    print_status "Testing DNS resolution..."
    if ping -c 1 -t 2 tenant-a.$DOMAIN &> /dev/null; then
        print_success "DNS resolution working: tenant-a.$DOMAIN -> 127.0.0.1"
        return 0
    else
        print_warning "DNS resolution test failed. You may need to wait a moment or restart your browser."
        return 1
    fi
}

# Show usage
show_usage() {
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --setup       Run initial setup (install dnsmasq, configure resolver)"
    echo "  --start       Start services and dev server (default)"
    echo "  --stop        Stop port forwarding"
    echo "  --status      Check status of all services"
    echo "  --no-pf       Skip port forwarding (use port 3000)"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --setup    # First-time setup"
    echo "  $0            # Start dev environment"
    echo "  $0 --no-pf    # Start without port forwarding"
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

    # Check port forwarding
    if sudo pfctl -s rules 2>/dev/null | grep -q "3000"; then
        print_success "Port forwarding: enabled (80 -> 3000)"
    else
        print_warning "Port forwarding: disabled"
    fi

    # Test DNS
    echo ""
    test_dns
    echo ""
}

# Stop port forwarding
stop_services() {
    print_status "Disabling port forwarding..."
    sudo pfctl -d 2>/dev/null || true
    print_success "Port forwarding disabled"
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
    setup_port_forwarding
    
    echo ""
    test_dns
    echo ""
    print_success "Setup complete!"
    echo ""
    echo "You can now access the app at:"
    echo "  http://tenant-a.$DOMAIN/"
    echo "  http://tenant-b.$DOMAIN/"
    echo "  http://[any-tenant].$DOMAIN/"
    echo ""
}

# Start dev environment
start_dev() {
    local skip_pf=$1

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
        setup_port_forwarding
    else
        print_status "Skipping port forwarding (use port 3000)"
    fi

    # Flush DNS cache
    flush_dns

    echo ""
    
    # Test DNS
    test_dns

    echo ""
    if [[ "$skip_pf" != "true" ]]; then
        echo "Access the app at:"
        echo "  http://tenant-a.$DOMAIN/"
        echo "  http://tenant-b.$DOMAIN/"
    else
        echo "Access the app at:"
        echo "  http://tenant-a.$DOMAIN:3000/"
        echo "  http://tenant-b.$DOMAIN:3000/"
    fi
    echo ""

    print_status "Starting Nuxt dev server..."
    echo ""

    # Start the dev server with HOST=0.0.0.0
    HOST=0.0.0.0 NUXT_AUTO_CREATE_TENANT=true pnpm nuxt dev
}

# Parse arguments
SKIP_PF="false"
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
        start_dev "$SKIP_PF"
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
esac
