// =============================================================================
// SALES PORTAL - Main Infrastructure Template
// =============================================================================
// Orchestrates deployment of Azure resources for the Sales Portal application.
// Uses modular Bicep templates for App Service Plan and Web App.
// =============================================================================

// -----------------------------------------------------------------------------
// Target Scope
// -----------------------------------------------------------------------------
targetScope = 'resourceGroup'

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param appName string = 'sales-portal'

@description('Container image to deploy (e.g., ghcr.io/org/repo:tag)')
param containerImage string

@description('GitHub Container Registry credentials - username')
@secure()
param ghcrUsername string = ''

@description('GitHub Container Registry credentials - token')
@secure()
param ghcrToken string = ''

// Application configuration
@description('Geins API Key')
@secure()
param geinsApiKey string = ''

@description('Geins API Endpoint')
param geinsApiEndpoint string = 'https://api.geins.io/graphql'

@description('Storage driver (fs or redis)')
param storageDriver string = 'fs'

@description('Redis URL for production storage')
@secure()
param redisUrl string = ''

@description('Enable analytics')
param enableAnalytics bool = false

@description('Log level')
@allowed(['debug', 'info', 'warn', 'error'])
param logLevel string = 'info'

// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------

// Resource naming convention: {appName}-{environment}-{resourceType}
var resourcePrefix = '${appName}-${environment}'

// SKU configuration per environment
var skuConfig = {
  dev: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  staging: {
    name: 'S1'
    tier: 'Standard'
    capacity: 1
  }
  prod: {
    name: 'P1v3'
    tier: 'PremiumV3'
    capacity: 2
  }
}

// Get SKU for current environment
var currentSku = skuConfig[environment]

// Tags for all resources
var tags = {
  Environment: environment
  Application: appName
  ManagedBy: 'Bicep'
  Repository: 'sales-portal'
}

// -----------------------------------------------------------------------------
// Modules
// -----------------------------------------------------------------------------

// App Service Plan
module appServicePlan 'modules/appServicePlan.bicep' = {
  name: '${resourcePrefix}-asp-deployment'
  params: {
    name: '${resourcePrefix}-asp'
    location: location
    skuName: currentSku.name
    skuTier: currentSku.tier
    skuCapacity: currentSku.capacity
    tags: tags
  }
}

// Web App
module webApp 'modules/webApp.bicep' = {
  name: '${resourcePrefix}-app-deployment'
  params: {
    name: '${resourcePrefix}-app'
    location: location
    appServicePlanId: appServicePlan.outputs.id
    containerImage: containerImage
    ghcrUsername: ghcrUsername
    ghcrToken: ghcrToken
    environment: environment
    tags: tags
    // Application settings
    geinsApiKey: geinsApiKey
    geinsApiEndpoint: geinsApiEndpoint
    storageDriver: storageDriver
    redisUrl: redisUrl
    enableAnalytics: enableAnalytics
    logLevel: logLevel
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('App Service Plan resource ID')
output appServicePlanId string = appServicePlan.outputs.id

@description('App Service Plan name')
output appServicePlanName string = appServicePlan.outputs.name

@description('Web App resource ID')
output webAppId string = webApp.outputs.id

@description('Web App name')
output webAppName string = webApp.outputs.name

@description('Web App default hostname')
output webAppHostname string = webApp.outputs.defaultHostname

@description('Web App URL')
output webAppUrl string = 'https://${webApp.outputs.defaultHostname}'

@description('Web App Managed Identity Principal ID')
output webAppPrincipalId string = webApp.outputs.principalId
