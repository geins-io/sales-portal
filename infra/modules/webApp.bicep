// =============================================================================
// SALES PORTAL - Web App Module
// =============================================================================
// Creates a Linux Web App configured for container deployment from GHCR.
// Includes managed identity, health checks, and application settings.
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Name of the Web App')
param name string

@description('Azure region for the resource')
param location string

@description('App Service Plan resource ID')
param appServicePlanId string

@description('GitHub Container Registry username')
@secure()
param ghcrUsername string

@description('GitHub Container Registry token')
@secure()
param ghcrToken string

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Resource tags')
param tags object = {}

// Application settings
@description('Geins API Endpoint')
param geinsApiEndpoint string

@description('Storage driver')
param storageDriver string

@description('Redis URL')
@secure()
param redisUrl string

@description('Enable analytics')
param enableAnalytics string

@description('Log level')
param logLevel string

@description('Version X code')
param versionX string

@description('Geins Tenant API URL')
param geinsTenantApiUrl string

@description('Health Check Secret')
@secure()
param healthCheckSecret string

// Sentry configuration
// NOTE: Only DSN is needed at runtime. Org/Project/AuthToken are build-time only.
// DSN is now server-only (NUXT_SENTRY_DSN) for security hardening.
@description('Sentry DSN for error tracking (server-side runtime)')
@secure()
param sentryDsn string = ''

// Monitoring settings
@description('Application Insights connection string')
param appInsightsConnectionString string = ''

@description('Application Insights instrumentation key')
param appInsightsInstrumentationKey string = ''

// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------

// Container registry server
var registryServer = 'ghcr.io'

// Node environment based on deployment environment
var nodeEnv = environment == 'prod' ? 'production' : environment == 'staging' ? 'production' : 'development'

// App settings for the site and the staging slot. One definition on purpose: a slot swap
// exchanges app settings, so a name declared on one side only lands in production at the
// next swap. Nothing here is a slot setting - see infra/README.md.
var sharedAppSettings = [
  // Container Registry Configuration
  {
    name: 'DOCKER_REGISTRY_SERVER_URL'
    value: 'https://${registryServer}'
  }
  {
    name: 'DOCKER_REGISTRY_SERVER_USERNAME'
    value: ghcrUsername
  }
  {
    name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
    value: ghcrToken
  }
  // Application Settings
  {
    name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
    value: 'false'
  }
  {
    name: 'WEBSITES_PORT'
    value: '3000'
  }
  // Container startup timeout (in seconds) - B1 tier requires longer startup time
  {
    name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
    value: '600'
  }
  // Nitro/Nuxt server binding - must bind to 0.0.0.0 for Azure
  {
    name: 'NITRO_HOST'
    value: '0.0.0.0'
  }
  {
    name: 'NITRO_PORT'
    value: '3000'
  }
  {
    name: 'NODE_ENV'
    value: nodeEnv
  }
  // ─────────────────────────────────────────────────────────────────────
  // NUXT RUNTIME CONFIG OVERRIDES
  // These MUST use NUXT_ prefix for Nuxt to pick them up at runtime.
  // See: nuxt.config.ts runtimeConfig section for the full mapping.
  // ─────────────────────────────────────────────────────────────────────
  {
    name: 'NUXT_GEINS_API_ENDPOINT'
    value: geinsApiEndpoint
  }
  {
    name: 'NUXT_GEINS_TENANT_API_URL'
    value: geinsTenantApiUrl
  }
  {
    name: 'NUXT_HEALTH_CHECK_SECRET'
    value: healthCheckSecret
  }
  {
    name: 'NUXT_STORAGE_DRIVER'
    value: storageDriver
  }
  {
    name: 'NUXT_STORAGE_REDIS_URL'
    value: redisUrl
  }
  {
    name: 'NUXT_PUBLIC_VERSION_X'
    value: versionX
  }
  {
    name: 'NUXT_PUBLIC_FEATURES_ANALYTICS'
    value: enableAnalytics
  }
  {
    name: 'LOG_LEVEL'
    value: logLevel
  }
  // Sentry Configuration
  // NUXT_SENTRY_DSN = runtime (server-side error tracking only)
  // SENTRY_* = build-time only (source map uploads) - not needed in Azure
  // Note: DSN is server-only for security hardening
  {
    name: 'NUXT_SENTRY_DSN'
    value: sentryDsn
  }
  // Application Insights Configuration
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
  {
    name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
    value: appInsightsInstrumentationKey
  }
  // Disable the auto-instrumentation agent for Linux containers - it can interfere with Node.js startup
  {
    name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
    value: '~0'
  }
]

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

// Neither resource declares linuxFxVersion. The image is set by the deploy workflow after this
// template is applied - on prod against the staging slot only, so a swap is the only thing that
// changes production's image. A property declared here would be written back over the swap on
// the next deployment. A site or slot created by this template therefore has no runtime until
// the workflow's image step has run.
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      alwaysOn: environment != 'dev' // Always On for staging and prod
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: sharedAppSettings
    }
  }
}

// Staging slot for prod environment (blue-green deployment)
resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = if (environment == 'prod') {
  parent: webApp
  name: 'staging'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: sharedAppSettings
    }
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Web App resource ID')
output id string = webApp.id

@description('Web App name')
output name string = webApp.name

@description('Web App default hostname')
output defaultHostname string = webApp.properties.defaultHostName

@description('Web App Managed Identity Principal ID')
output principalId string = webApp.identity.principalId
