#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Azure Infrastructure Setup Script
# =============================================================================
# This script sets up the Azure infrastructure for the Sales Portal including:
# - Resource groups for each environment
# - Service principal with federated credentials for GitHub Actions
# - Assigns necessary roles to the service principal
#
# Prerequisites:
# - Azure CLI installed and authenticated (az login)
# - Sufficient permissions to create App Registrations and assign roles
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
APP_NAME="sales-portal"
SP_DISPLAY_NAME="sales-portal-github-actions"
LOCATION="${AZURE_LOCATION:-westeurope}"
GITHUB_REPO="${GITHUB_REPOSITORY:-geins-io/sales-portal}"

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

# -----------------------------------------------------------------------------
# Main Functions
# -----------------------------------------------------------------------------
get_subscription_info() {
    log_info "Getting Azure subscription information..."
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    TENANT_ID=$(az account show --query tenantId -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    
    echo ""
    echo "Current Azure subscription:"
    echo "  Name: $SUBSCRIPTION_NAME"
    echo "  ID: $SUBSCRIPTION_ID"
    echo "  Tenant ID: $TENANT_ID"
    echo ""
}

create_resource_groups() {
    log_info "Creating resource groups for each environment..."
    
    for env in dev staging prod; do
        RG_NAME="rg-${APP_NAME}-${env}"
        log_info "Creating resource group: $RG_NAME"
        
        az group create \
            --name "$RG_NAME" \
            --location "$LOCATION" \
            --tags Environment="$env" Application="$APP_NAME" ManagedBy="Bicep" \
            --output none 2>/dev/null || log_warning "Resource group $RG_NAME already exists"
        
        log_success "Resource group $RG_NAME ready"
    done
}

create_service_principal() {
    log_info "Creating service principal for GitHub Actions..."
    
    # Check if App Registration already exists
    EXISTING_APP_ID=$(az ad app list --display-name "$SP_DISPLAY_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")
    
    if [[ -n "$EXISTING_APP_ID" && "$EXISTING_APP_ID" != "null" ]]; then
        log_warning "App Registration '$SP_DISPLAY_NAME' already exists with ID: $EXISTING_APP_ID"
        APP_ID="$EXISTING_APP_ID"
    else
        log_info "Creating new App Registration..."
        az ad app create --display-name "$SP_DISPLAY_NAME" --output none
        APP_ID=$(az ad app list --display-name "$SP_DISPLAY_NAME" --query "[0].appId" -o tsv)
        log_success "App Registration created with ID: $APP_ID"
    fi
    
    # Check if Service Principal exists
    EXISTING_SP=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv 2>/dev/null || echo "")
    
    if [[ -z "$EXISTING_SP" || "$EXISTING_SP" == "null" ]]; then
        log_info "Creating Service Principal..."
        az ad sp create --id "$APP_ID" --output none
        log_success "Service Principal created"
    else
        log_warning "Service Principal already exists"
    fi
    
    SP_OBJECT_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)
    
    echo ""
    echo "Service Principal information:"
    echo "  Display Name: $SP_DISPLAY_NAME"
    echo "  App (Client) ID: $APP_ID"
    echo "  Object ID: $SP_OBJECT_ID"
    echo ""
    
    CLIENT_ID="$APP_ID"
}

assign_roles() {
    log_info "Assigning Contributor role to resource groups..."
    
    for env in dev staging prod; do
        RG_NAME="rg-${APP_NAME}-${env}"
        SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}"
        
        log_info "Assigning Contributor role for $RG_NAME..."
        
        # Check if role assignment already exists
        EXISTING_ASSIGNMENT=$(az role assignment list \
            --assignee "$SP_OBJECT_ID" \
            --role "Contributor" \
            --scope "$SCOPE" \
            --query "[0].id" -o tsv 2>/dev/null || echo "")
        
        if [[ -z "$EXISTING_ASSIGNMENT" ]]; then
            az role assignment create \
                --assignee "$SP_OBJECT_ID" \
                --role "Contributor" \
                --scope "$SCOPE" \
                --output none
            log_success "Role assigned for $RG_NAME"
        else
            log_warning "Role assignment already exists for $RG_NAME"
        fi
    done
}

create_federated_credentials() {
    log_info "Creating federated credentials for GitHub Actions OIDC..."
    
    # Define credentials to create (using parallel arrays for bash 3.x compatibility)
    cred_names=(
        "github-main"
        "github-tags"
        "github-env-dev"
        "github-env-staging"
        "github-env-prod"
        "github-env-prod-swap"
    )
    cred_subjects=(
        "repo:${GITHUB_REPO}:ref:refs/heads/main"
        "repo:${GITHUB_REPO}:ref:refs/tags/*"
        "repo:${GITHUB_REPO}:environment:dev"
        "repo:${GITHUB_REPO}:environment:staging"
        "repo:${GITHUB_REPO}:environment:prod"
        "repo:${GITHUB_REPO}:environment:prod-swap"
    )

    for i in "${!cred_names[@]}"; do
        name="${cred_names[$i]}"
        subject="${cred_subjects[$i]}"
        log_info "Creating federated credential: $name"
        
        # Check if credential already exists
        EXISTING_CRED=$(az ad app federated-credential list \
            --id "$APP_ID" \
            --query "[?name=='$name'].id" -o tsv 2>/dev/null || echo "")
        
        if [[ -n "$EXISTING_CRED" ]]; then
            log_warning "Federated credential '$name' already exists, updating..."
            az ad app federated-credential delete --id "$APP_ID" --federated-credential-id "$name" --output none 2>/dev/null || true
        fi
        
        az ad app federated-credential create \
            --id "$APP_ID" \
            --parameters "{
                \"name\": \"$name\",
                \"issuer\": \"https://token.actions.githubusercontent.com\",
                \"subject\": \"$subject\",
                \"audiences\": [\"api://AzureADTokenExchange\"]
            }" \
            --output none
        
        log_success "Created federated credential: $name"
    done
}

print_github_secrets() {
    echo ""
    echo "============================================================================="
    echo -e "${GREEN}Setup Complete!${NC}"
    echo "============================================================================="
    echo ""
    echo "Add the following secrets to your GitHub repository:"
    echo "(Settings → Secrets and variables → Actions → Secrets)"
    echo ""
    echo "┌─────────────────────────┬───────────────────────────────────────────────┐"
    echo "│ Repository Secret       │ Value                                         │"
    echo "├─────────────────────────┼───────────────────────────────────────────────┤"
    printf "│ %-23s │ %-45s │\n" "AZURE_CLIENT_ID" "$CLIENT_ID"
    printf "│ %-23s │ %-45s │\n" "AZURE_TENANT_ID" "$TENANT_ID"
    printf "│ %-23s │ %-45s │\n" "AZURE_SUBSCRIPTION_ID" "$SUBSCRIPTION_ID"
    echo "└─────────────────────────┴───────────────────────────────────────────────┘"
    echo ""
    echo "Optional Environment Secrets (configure per GitHub Environment if needed):"
    echo "┌─────────────────────────┬───────────────────────────────────────────────┐"
    echo "│ Environment Secret      │ Value                                         │"
    echo "├─────────────────────────┼───────────────────────────────────────────────┤"
    printf "│ %-23s │ %-45s │\n" "REDIS_URL" "<your-redis-connection-string>"
    echo "└─────────────────────────┴───────────────────────────────────────────────┘"
    echo ""
    echo -e "${BLUE}Note: GEINS_API_KEY is NOT configured at deployment time.${NC}"
    echo -e "${BLUE}It is part of the tenant configuration when binding a domain.${NC}"
    echo -e "${BLUE}See shared/types/tenant-config.ts for GeinsSettings interface.${NC}"
    echo ""
    echo "Optional GitHub Variables (Settings → Secrets and variables → Actions → Variables):"
    echo "┌─────────────────────────┬───────────────────────────────────────────────┐"
    echo "│ Variable Name           │ Default Value                                 │"
    echo "├─────────────────────────┼───────────────────────────────────────────────┤"
    printf "│ %-23s │ %-45s │\n" "GEINS_API_ENDPOINT" "https://api.geins.io/graphql"
    printf "│ %-23s │ %-45s │\n" "STORAGE_DRIVER" "fs"
    printf "│ %-23s │ %-45s │\n" "ENABLE_ANALYTICS" "false"
    printf "│ %-23s │ %-45s │\n" "LOG_LEVEL" "info"
    echo "└─────────────────────────┴───────────────────────────────────────────────┘"
    echo ""
    echo "Create GitHub Environments (Settings → Environments):"
    echo "  - dev"
    echo "  - staging"
    echo "  - prod (add protection rules and required reviewers)"
    echo "  - prod-swap (add protection rules and required reviewers)"
    echo ""
    echo "============================================================================="
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Sets up Azure infrastructure for the Sales Portal."
    echo ""
    echo "Options:"
    echo "  --help, -h              Show this help message"
    echo "  --rg-only               Only create resource groups"
    echo "  --sp-only               Only create service principal"
    echo "  --creds-only            Only create federated credentials"
    echo "  --skip-rg               Skip resource group creation"
    echo "  --skip-sp               Skip service principal creation"
    echo "  --skip-creds            Skip federated credentials creation"
    echo ""
    echo "Environment Variables:"
    echo "  AZURE_LOCATION          Azure region (default: westeurope)"
    echo "  GITHUB_REPOSITORY       GitHub repository (default: geins-io/sales-portal)"
    echo ""
    echo "Examples:"
    echo "  $0                      Run full setup"
    echo "  $0 --rg-only            Only create resource groups"
    echo "  AZURE_LOCATION=northeurope $0  Use different region"
    echo ""
}

# -----------------------------------------------------------------------------
# Main Script
# -----------------------------------------------------------------------------
main() {
    local skip_rg=false
    local skip_sp=false
    local skip_creds=false
    local rg_only=false
    local sp_only=false
    local creds_only=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --rg-only)
                rg_only=true
                shift
                ;;
            --sp-only)
                sp_only=true
                shift
                ;;
            --creds-only)
                creds_only=true
                shift
                ;;
            --skip-rg)
                skip_rg=true
                shift
                ;;
            --skip-sp)
                skip_sp=true
                shift
                ;;
            --skip-creds)
                skip_creds=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                ;;
        esac
    done
    
    echo ""
    echo "============================================================================="
    echo "  Sales Portal - Azure Infrastructure Setup"
    echo "============================================================================="
    echo ""
    
    # Prerequisite checks
    check_az_cli
    check_az_login
    get_subscription_info
    
    # Handle *-only flags
    if [[ "$rg_only" == true ]]; then
        create_resource_groups
        log_success "Resource group creation complete!"
        exit 0
    fi
    
    if [[ "$sp_only" == true ]]; then
        create_service_principal
        assign_roles
        print_github_secrets
        exit 0
    fi
    
    if [[ "$creds_only" == true ]]; then
        APP_ID=$(az ad app list --display-name "$SP_DISPLAY_NAME" --query "[0].appId" -o tsv)
        if [[ -z "$APP_ID" ]]; then
            log_error "Service principal not found. Run setup without --creds-only first."
        fi
        CLIENT_ID="$APP_ID"
        create_federated_credentials
        print_github_secrets
        exit 0
    fi
    
    # Full setup
    if [[ "$skip_rg" != true ]]; then
        create_resource_groups
    fi
    
    if [[ "$skip_sp" != true ]]; then
        create_service_principal
        assign_roles
    else
        APP_ID=$(az ad app list --display-name "$SP_DISPLAY_NAME" --query "[0].appId" -o tsv)
        CLIENT_ID="$APP_ID"
    fi
    
    if [[ "$skip_creds" != true ]]; then
        create_federated_credentials
    fi
    
    print_github_secrets
}

main "$@"
