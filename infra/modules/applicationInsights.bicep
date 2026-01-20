// =============================================================================
// SALES PORTAL - Application Insights Module
// =============================================================================
// Creates Application Insights for monitoring, logging, and performance tracking.
// Includes Log Analytics workspace for centralized logging and alerting.
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Name of the Application Insights resource')
param name string

@description('Name of the Log Analytics workspace')
param workspaceName string

@description('Azure region for the resources')
param location string

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Resource tags')
param tags object = {}

@description('Web App resource ID for connection')
param webAppResourceId string = ''

@description('Daily data cap in GB (0 = no cap)')
param dailyCapGb int = environment == 'prod' ? 10 : 1

@description('Data retention period in days')
param retentionDays int = environment == 'prod' ? 90 : 30

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

// Log Analytics Workspace - Central log storage and query engine
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: dailyCapGb > 0 ? dailyCapGb : -1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Application Insights - APM and telemetry
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: retentionDays
    DisableIpMasking: false
    DisableLocalAuth: false
    SamplingPercentage: environment == 'prod' ? 50 : 100
  }
}

// Smart Detection Rules - Enabled by default in Application Insights
// These detect anomalies automatically (slow responses, failure rates, etc.)

// Availability Test - Monitor the health endpoint
resource availabilityTest 'Microsoft.Insights/webtests@2022-06-15' = if (webAppResourceId != '' && environment != 'dev') {
  name: '${name}-health-check'
  location: location
  tags: union(tags, {
    'hidden-link:${applicationInsights.id}': 'Resource'
  })
  kind: 'ping'
  properties: {
    SyntheticMonitorId: '${name}-health-check'
    Name: 'Health Check'
    Enabled: true
    Frequency: 300 // 5 minutes
    Timeout: 30
    Kind: 'ping'
    RetryEnabled: true
    Locations: [
      {
        Id: 'emea-nl-ams-azr' // Amsterdam
      }
      {
        Id: 'emea-gb-db3-azr' // Dublin
      }
      {
        Id: 'emea-se-sto-edge' // Stockholm
      }
    ]
    Configuration: {
      WebTest: '''
<WebTest Name="HealthCheck" Id="${guid('${name}-health-check')}" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="30" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale="">
  <Items>
    <Request Method="GET" Guid="${guid('${name}-health-request')}" Version="1.1" Url="https://${reference(webAppResourceId, '2023-12-01').defaultHostName}/api/health" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" />
  </Items>
</WebTest>
'''
    }
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Application Insights resource ID')
output id string = applicationInsights.id

@description('Application Insights name')
output name string = applicationInsights.name

@description('Application Insights instrumentation key')
output instrumentationKey string = applicationInsights.properties.InstrumentationKey

@description('Application Insights connection string')
output connectionString string = applicationInsights.properties.ConnectionString

@description('Log Analytics workspace resource ID')
output workspaceId string = logAnalyticsWorkspace.id

@description('Log Analytics workspace name')
output workspaceNameOutput string = logAnalyticsWorkspace.name

@description('Log Analytics workspace customer ID (for queries)')
output workspaceCustomerId string = logAnalyticsWorkspace.properties.customerId
