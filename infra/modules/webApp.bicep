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
// NOTE: Only the DSN is needed at runtime. Org/Project/AuthToken are build-time
// only, consumed by the source map upload in build.yml.
@description('Sentry DSN for error tracking, server and browser')
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
  // The same DSN is handed to the server and the browser below; the build-time
  // SENTRY_ORG/PROJECT/AUTH_TOKEN are not needed in Azure.
  {
    name: 'NUXT_SENTRY_DSN'
    value: sentryDsn
  }
  // Names the deployment for Sentry, independently of NODE_ENV: `staging`
  // builds run with NODE_ENV=production above, so NODE_ENV cannot separate
  // staging events from prod ones. Both the server and the browser SDK read
  // their own variable.
  {
    name: 'SENTRY_ENVIRONMENT'
    value: environment
  }
  {
    name: 'NUXT_PUBLIC_SENTRY_ENVIRONMENT'
    value: environment
  }
  // Outside prod sentry.server.config.ts turns the SDK's debug logging on, which
  // lands in the container log stream where it drowns the application's own
  // lines and nothing reads it. Set on every environment: prod suppresses the
  // logging anyway, so one value keeps it unambiguous.
  {
    name: 'SENTRY_SILENT'
    value: 'true'
  }
  // Same DSN, handed to the browser so errors that never reach the server are
  // reported too. A public DSN is visible in the page source by design: it can
  // only be used to send events in, so the exposure is quota abuse, not data
  // loss. Remove this setting to turn browser reporting off again.
  {
    name: 'NUXT_PUBLIC_SENTRY_DSN'
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
