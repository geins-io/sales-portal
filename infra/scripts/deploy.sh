#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Manual Deployment Script
# =============================================================================
# This script deploys the Sales Portal infrastructure and application to Azure.
# Use this for manual deployments outside of GitHub Actions.
#
# Prerequisites:
# - Azure CLI installed and authenticated (az login)
# - Docker image already pushed to GHCR
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"

APP_NAME="sales-portal"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

check_az_cli() {
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/cli/azure/install-azure-cli"
    fi
}

check_az_login() {
    if ! az account show &> /dev/null; then
        log_error "You are not logged in to Azure. Please run 'az login' first."
    fi
}

get_default_image() {
    local env="$1"
    
    # Try to get GitHub repository from git remote
    local repo=""
    if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null; then
        repo=$(git remote get-url origin 2>/dev/null | sed -E 's#.*github\.com[:/]##' | sed 's/\.git$//')
    fi
    
    # Fallback to default repository
    if [[ -z "$repo" ]]; then
        repo="geins-io/sales-portal"
    fi
    
    # Determine tag based on environment
    local tag=""
    case "$env" in
        dev)
            # Use current branch name or 'dev'
            if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null; then
                tag=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's/[^a-zA-Z0-9._-]/-/g')
            fi
            tag="${tag:-dev}"
            ;;
        staging)
            tag="main"
            ;;
        prod)
            # Use latest tag or 'latest'
            if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null; then
                tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "latest")
            else
                tag="latest"
            fi
            ;;
    esac
    
    echo "ghcr.io/${repo}:${tag}"
}

# -----------------------------------------------------------------------------
# Main Functions
# -----------------------------------------------------------------------------
show_help() {
    echo "Usage: $0 --env <environment> [--image <container-image>] [OPTIONS]"
    echo ""
    echo "Deploys the Sales Portal infrastructure and application to Azure."
    echo "If no image is specified, derives one from git context (branch/tag)."
    echo ""
    echo "Required Arguments:"
    echo "  --env, -e <env>         Environment (dev, staging, prod)"
    echo ""
    echo "Optional Arguments:"
    echo "  --image, -i <image>     Container image (default: derived from git context)"
    echo "  --ghcr-username <user>  GitHub username for GHCR (default: current user)"
    echo "  --ghcr-token <token>    GitHub PAT for GHCR (default: from GHCR_TOKEN env var)"
    echo "  --redis-url <url>       Redis connection URL (default: from REDIS_URL env var)"
    echo "  --what-if               Preview changes without deploying"
    echo "  --help, -h              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  GHCR_TOKEN              GitHub PAT with packages:read permission"
    echo "  REDIS_URL               Redis connection string"
    echo ""
    echo "Note: GEINS_API_KEY is NOT configured at deployment time. It is part of"
    echo "      the tenant configuration when binding a domain to the application."
    echo ""
    echo "Examples:"
    echo "  $0 --env dev --image ghcr.io/geins-io/sales-portal:dev"
    echo "  $0 --env staging --image ghcr.io/geins-io/sales-portal:main --what-if"
    echo "  $0 --env prod --image ghcr.io/geins-io/sales-portal:v1.0.0"
    echo ""
}

deploy() {
    local environment="$1"
    local container_image="$2"
    local ghcr_username="$3"
    local ghcr_token="$4"
    local redis_url="$5"
    local what_if="$6"
    
    local resource_group="rg-${APP_NAME}-${environment}"
    local parameters_file="${INFRA_DIR}/parameters/${environment}.bicepparam"
    local template_file="${INFRA_DIR}/main.bicep"
    
    log_info "Deployment configuration:"
    echo "  Environment: $environment"
    echo "  Resource Group: $resource_group"
    echo "  Container Image: $container_image"
    echo "  Parameters File: $parameters_file"
    echo ""
    
    # Check if resource group exists
    if ! az group show --name "$resource_group" &> /dev/null; then
        log_info "Creating resource group: $resource_group"
        az group create \
            --name "$resource_group" \
            --location westeurope \
            --tags Environment="$environment" Application="$APP_NAME" ManagedBy="Bicep" \
            --output none
        log_success "Resource group created"
    fi
    
    # Build deployment command
    local deploy_cmd="az deployment group"
    
    if [[ "$what_if" == true ]]; then
        deploy_cmd+=" what-if"
        log_info "Running what-if deployment (preview mode)..."
    else
        deploy_cmd+=" create"
        log_info "Starting deployment..."
    fi
    
    # Build parameters string
    local params="containerImage=$container_image"
    [[ -n "$ghcr_username" ]] && params+=" ghcrUsername=$ghcr_username"
    [[ -n "$ghcr_token" ]] && params+=" ghcrToken=$ghcr_token"
    [[ -n "$redis_url" ]] && params+=" redisUrl=$redis_url"
    
    # Execute deployment
    $deploy_cmd \
        --resource-group "$resource_group" \
        --template-file "$template_file" \
        --parameters "$parameters_file" \
        --parameters $params \
        --name "manual-deploy-$(date +%Y%m%d-%H%M%S)"
    
    if [[ "$what_if" != true ]]; then
        log_success "Deployment complete!"
        
        # Get outputs
        log_info "Fetching deployment outputs..."
        local webapp_url=$(az deployment group show \
            --resource-group "$resource_group" \
            --name "manual-deploy-*" \
            --query properties.outputs.webAppUrl.value \
            --output tsv 2>/dev/null | tail -1 || echo "")
        
        if [[ -n "$webapp_url" ]]; then
            echo ""
            echo "Web App URL: $webapp_url"
            echo ""
        fi
    fi
}

# -----------------------------------------------------------------------------
# Main Script
# -----------------------------------------------------------------------------
main() {
    local environment=""
    local container_image=""
    local ghcr_username="${GHCR_USERNAME:-$(whoami)}"
    local ghcr_token="${GHCR_TOKEN:-}"
    local redis_url="${REDIS_URL:-}"
    local what_if=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --env|-e)
                environment="$2"
                shift 2
                ;;
            --image|-i)
                container_image="$2"
                shift 2
                ;;
            --ghcr-username)
                ghcr_username="$2"
                shift 2
                ;;
            --ghcr-token)
                ghcr_token="$2"
                shift 2
                ;;
            --redis-url)
                redis_url="$2"
                shift 2
                ;;
            --what-if)
                what_if=true
                shift
                ;;
            *)
                log_error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    # Validate required arguments
    if [[ -z "$environment" ]]; then
        log_error "Environment is required. Use --env <dev|staging|prod>"
    fi
    
    if [[ ! "$environment" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment: $environment. Must be one of: dev, staging, prod"
    fi
    
    # Derive container image if not provided
    if [[ -z "$container_image" ]]; then
        container_image=$(get_default_image "$environment")
        log_info "No image specified, using: $container_image"
    fi
    
    echo ""
    echo "============================================================================="
    echo "  Sales Portal - Manual Deployment"
    echo "============================================================================="
    echo ""
    
    # Prerequisite checks
    check_az_cli
    check_az_login
    
    # Run deployment
    deploy "$environment" "$container_image" "$ghcr_username" "$ghcr_token" "$redis_url" "$what_if"
}

main "$@"
