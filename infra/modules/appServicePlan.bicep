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
    // Off on purpose, also on PremiumV3. Zone redundancy needs several instances
    // spread across zones, and this application runs one: its tenant cache lives in
    // the process and the config-refresh webhook reaches a single instance, so more
    // than one would serve different configuration. Turning it on here would also
    // have tripled the instance count the first time prod moved to a v3 tier.
    zoneRedundant: false
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('App Service Plan resource ID')
output id string = appServicePlan.id

@description('App Service Plan name')
output name string = appServicePlan.name
