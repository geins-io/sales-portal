// =============================================================================
// SALES PORTAL - Main Infrastructure Template
// =============================================================================
// Orchestrates deployment of Azure resources for the Sales Portal application.
// Uses modular Bicep templates for App Service Plan, Web App, and Monitoring.
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
@description('Geins API Endpoint')
param geinsApiEndpoint string = ''

@description('Geins Tenant API URL')
param geinsTenantApiUrl string = ''

@description('Geins Tenant API Key')
@secure()
param geinsTenantApiKey string = ''

@description('Health Check Secret')
@secure()
param healthCheckSecret string = ''

@description('Storage driver (memory, fs, or redis)')
param storageDriver string = ''

@description('Redis URL for production storage')
@secure()
param redisUrl string = ''

@description('Enable analytics')
param enableAnalytics string = ''

@description('Log level')
param logLevel string = 'info'

@description('Version X code')
param versionX string = ''

// Sentry configuration
// NOTE: Only SENTRY_DSN is needed at runtime. SENTRY_ORG, SENTRY_PROJECT, and
// SENTRY_AUTH_TOKEN are build-time only (for source map uploads in GitHub Actions).
@description('Sentry DSN for error tracking (runtime)')
@secure()
param sentryDsn string = ''

// Monitoring configuration
@description('Enable Application Insights monitoring')
param enableMonitoring bool = true

@description('Email addresses for alert notifications (comma-separated)')
param alertEmails array = []

@description('Daily data cap for logging in GB (0 = no cap)')
param logDataCapGb int = 0

@description('Log retention period in days')
param logRetentionDays int = 30

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

// Application Insights & Log Analytics (Monitoring)
module monitoring 'modules/applicationInsights.bicep' = if (enableMonitoring) {
  name: '${resourcePrefix}-monitoring-deployment'
  params: {
    name: '${resourcePrefix}-ai'
    workspaceName: '${resourcePrefix}-logs'
    location: location
    environment: environment
    tags: tags
    dailyCapGb: logDataCapGb > 0 ? logDataCapGb : (environment == 'prod' ? 10 : 1)
    retentionDays: logRetentionDays > 0 ? logRetentionDays : (environment == 'prod' ? 90 : 30)
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
    geinsApiEndpoint: geinsApiEndpoint
    geinsTenantApiUrl: geinsTenantApiUrl
    geinsTenantApiKey: geinsTenantApiKey
    healthCheckSecret: healthCheckSecret
    storageDriver: storageDriver
    redisUrl: redisUrl
    enableAnalytics: enableAnalytics
    logLevel: logLevel
    versionX: versionX
    // Sentry (runtime only - build-time vars are in GitHub Actions)
    sentryDsn: sentryDsn
    // Application Insights connection
    appInsightsConnectionString: enableMonitoring ? monitoring.outputs.connectionString : ''
    appInsightsInstrumentationKey: enableMonitoring ? monitoring.outputs.instrumentationKey : ''
  }
}

// Alert Rules (only for staging and prod with monitoring enabled)
module alertRules 'modules/alertRules.bicep' = if (enableMonitoring && environment != 'dev') {
  name: '${resourcePrefix}-alerts-deployment'
  params: {
    namePrefix: resourcePrefix
    location: location
    environment: environment
    tags: tags
    applicationInsightsId: monitoring.outputs.id
    webAppId: webApp.outputs.id
    alertEmails: alertEmails
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

// Monitoring Outputs
@description('Application Insights resource ID')
output appInsightsId string = enableMonitoring ? monitoring.outputs.id : ''

@description('Application Insights name')
output appInsightsName string = enableMonitoring ? monitoring.outputs.name : ''

@description('Application Insights connection string')
output appInsightsConnectionString string = enableMonitoring ? monitoring.outputs.connectionString : ''

@description('Log Analytics workspace ID')
output logAnalyticsWorkspaceId string = enableMonitoring ? monitoring.outputs.workspaceId : ''

@description('Log Analytics workspace name')
output logAnalyticsWorkspaceName string = enableMonitoring ? monitoring.outputs.workspaceNameOutput : ''
