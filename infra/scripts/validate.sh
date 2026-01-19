#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Bicep Template Validation Script
# =============================================================================
# This script validates and builds the Bicep templates to ensure they are
# syntactically correct and will deploy successfully.
#
# Prerequisites:
# - Azure CLI installed with Bicep extension
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

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
}

check_az_cli() {
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/cli/azure/install-azure-cli"
        exit 1
    fi
}

check_bicep() {
    if ! az bicep version &> /dev/null; then
        log_info "Installing Bicep CLI..."
        az bicep install
    fi
}

# -----------------------------------------------------------------------------
# Main Functions
# -----------------------------------------------------------------------------
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Validates the Bicep templates for the Sales Portal infrastructure."
    echo ""
    echo "Options:"
    echo "  --help, -h              Show this help message"
    echo "  --build-only            Only build templates, don't validate against Azure"
    echo "  --env <environment>     Validate what-if for specific environment"
    echo ""
    echo "Examples:"
    echo "  $0                      Validate all templates (syntax only)"
    echo "  $0 --build-only         Build templates to ARM JSON"
    echo "  $0 --env dev            Run what-if validation for dev environment"
    echo ""
}

validate_syntax() {
    local file="$1"
    local filename=$(basename "$file")
    
    log_info "Validating syntax: $filename"
    
    if az bicep build --file "$file" --stdout > /dev/null 2>&1; then
        log_success "$filename - Syntax valid"
        return 0
    else
        log_error "$filename - Syntax errors found:"
        az bicep build --file "$file" 2>&1 || true
        return 1
    fi
}

build_template() {
    local file="$1"
    local output_file="${file%.bicep}.json"
    local filename=$(basename "$file")
    
    log_info "Building: $filename"
    
    if az bicep build --file "$file" --outfile "$output_file"; then
        log_success "Built: $(basename "$output_file")"
        return 0
    else
        log_error "Failed to build: $filename"
        return 1
    fi
}

validate_what_if() {
    local environment="$1"
    local resource_group="rg-sales-portal-${environment}"
    local template_file="${INFRA_DIR}/main.bicep"
    local parameters_file="${INFRA_DIR}/parameters/${environment}.bicepparam"
    
    log_info "Running what-if validation for $environment environment..."
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        log_warning "Not logged in to Azure. Skipping what-if validation."
        log_info "Run 'az login' to enable what-if validation."
        return 0
    fi
    
    # Check if resource group exists
    if ! az group show --name "$resource_group" &> /dev/null; then
        log_warning "Resource group $resource_group does not exist. Skipping what-if validation."
        log_info "Run 'pnpm infra:setup' to create resource groups."
        return 0
    fi
    
    log_info "Validating deployment to $resource_group..."
    
    az deployment group what-if \
        --resource-group "$resource_group" \
        --template-file "$template_file" \
        --parameters "$parameters_file" \
        --parameters containerImage="ghcr.io/geins-io/sales-portal:validate"
    
    log_success "What-if validation complete for $environment"
}

# -----------------------------------------------------------------------------
# Main Script
# -----------------------------------------------------------------------------
main() {
    local build_only=false
    local environment=""
    local errors=0
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --build-only)
                build_only=true
                shift
                ;;
            --env)
                environment="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    echo ""
    echo "============================================================================="
    echo "  Sales Portal - Bicep Template Validation"
    echo "============================================================================="
    echo ""
    
    # Prerequisite checks
    check_az_cli
    check_bicep
    
    # Find all Bicep files
    BICEP_FILES=(
        "${INFRA_DIR}/main.bicep"
        "${INFRA_DIR}/modules/appServicePlan.bicep"
        "${INFRA_DIR}/modules/webApp.bicep"
    )
    
    echo ""
    log_info "Found ${#BICEP_FILES[@]} Bicep files to validate"
    echo ""
    
    # Validate or build each file
    for file in "${BICEP_FILES[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_warning "File not found: $file"
            continue
        fi
        
        if [[ "$build_only" == true ]]; then
            if ! build_template "$file"; then
                ((errors++))
            fi
        else
            if ! validate_syntax "$file"; then
                ((errors++))
            fi
        fi
    done
    
    echo ""
    
    # Run what-if validation if environment specified
    if [[ -n "$environment" ]]; then
        if [[ ! "$environment" =~ ^(dev|staging|prod)$ ]]; then
            log_error "Invalid environment: $environment. Must be one of: dev, staging, prod"
            exit 1
        fi
        validate_what_if "$environment"
    fi
    
    # Summary
    echo ""
    echo "============================================================================="
    if [[ $errors -eq 0 ]]; then
        log_success "All validations passed!"
        exit 0
    else
        log_error "$errors template(s) have errors"
        exit 1
    fi
}

main "$@"
