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
        {
          name: 'NODE_ENV'
          value: nodeEnv
        }
        {
          name: 'GEINS_API_ENDPOINT'
          value: geinsApiEndpoint
        }
        {
          name: 'STORAGE_DRIVER'
          value: storageDriver
        }
        {
          name: 'REDIS_URL'
          value: redisUrl
        }
        {
          name: 'NUXT_PUBLIC_ENABLE_ANALYTICS'
          value: string(enableAnalytics)
        }
        {
          name: 'LOG_LEVEL'
          value: logLevel
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
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'GEINS_API_ENDPOINT'
          value: geinsApiEndpoint
        }
        {
          name: 'STORAGE_DRIVER'
          value: storageDriver
        }
        {
          name: 'REDIS_URL'
          value: redisUrl
        }
        {
          name: 'NUXT_PUBLIC_ENABLE_ANALYTICS'
          value: string(enableAnalytics)
        }
        {
          name: 'LOG_LEVEL'
          value: logLevel
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
