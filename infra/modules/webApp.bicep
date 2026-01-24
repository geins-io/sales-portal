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

@description('Container image to deploy')
param containerImage string

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
param enableAnalytics bool

@description('Log level')
param logLevel string

// Sentry configuration
// NOTE: Only DSN is needed at runtime. Org/Project/AuthToken are build-time only.
@description('Sentry DSN for error tracking (runtime)')
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

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

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
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: environment != 'dev' // Always On for staging and prod
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: [
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
          name: 'NUXT_STORAGE_DRIVER'
          value: storageDriver
        }
        {
          name: 'NUXT_STORAGE_REDIS_URL'
          value: redisUrl
        }
        {
          name: 'NUXT_PUBLIC_FEATURES_ANALYTICS'
          value: string(enableAnalytics)
        }
        {
          name: 'LOG_LEVEL'
          value: logLevel
        }
        // Sentry Configuration
        // NUXT_PUBLIC_SENTRY_DSN = runtime (client error tracking)
        // SENTRY_* = build-time only (source map uploads) - not needed in Azure
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
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: [
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
          value: 'production'
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
          name: 'NUXT_STORAGE_DRIVER'
          value: storageDriver
        }
        {
          name: 'NUXT_STORAGE_REDIS_URL'
          value: redisUrl
        }
        {
          name: 'NUXT_PUBLIC_FEATURES_ANALYTICS'
          value: string(enableAnalytics)
        }
        {
          name: 'LOG_LEVEL'
          value: logLevel
        }
        // Sentry Configuration
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
