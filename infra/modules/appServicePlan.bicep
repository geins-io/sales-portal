// =============================================================================
// SALES PORTAL - App Service Plan Module
// =============================================================================
// Creates a Linux App Service Plan for hosting containerized applications.
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Name of the App Service Plan')
param name string

@description('Azure region for the resource')
param location string

@description('SKU name (e.g., B1, S1, P1v3)')
param skuName string

@description('SKU tier (e.g., Basic, Standard, PremiumV3)')
param skuTier string

@description('Number of instances')
@minValue(1)
@maxValue(30)
param skuCapacity int = 1

@description('Resource tags')
param tags object = {}

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: skuName
    tier: skuTier
    capacity: skuCapacity
  }
  properties: {
    reserved: true // Required for Linux
    zoneRedundant: skuTier == 'PremiumV3' ? true : false // Enable zone redundancy for production
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('App Service Plan resource ID')
output id string = appServicePlan.id

@description('App Service Plan name')
output name string = appServicePlan.name
