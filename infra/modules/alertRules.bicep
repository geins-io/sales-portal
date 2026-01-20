// =============================================================================
// SALES PORTAL - Alert Rules Module
// =============================================================================
// Creates Azure Monitor alert rules for proactive monitoring and alerting.
// Includes alerts for availability, response time, errors, and resource health.
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Base name for alert rules')
param namePrefix string

@description('Azure region for the resources')
param location string

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Resource tags')
param tags object = {}

@description('Application Insights resource ID')
param applicationInsightsId string

@description('Web App resource ID')
param webAppId string

@description('Action Group resource ID for notifications (optional)')
param actionGroupId string = ''

@description('Email addresses for critical alerts')
param alertEmails array = []

// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------

// Alert severity levels
// 0 = Critical, 1 = Error, 2 = Warning, 3 = Informational, 4 = Verbose
var severityLevels = {
  critical: 0
  error: 1
  warning: 2
  info: 3
}

// Environment-specific thresholds
var thresholds = {
  dev: {
    responseTimeMs: 5000
    failureRatePercent: 20
    serverErrorCount: 10
    cpuPercent: 90
    memoryPercent: 90
  }
  staging: {
    responseTimeMs: 3000
    failureRatePercent: 10
    serverErrorCount: 5
    cpuPercent: 85
    memoryPercent: 85
  }
  prod: {
    responseTimeMs: 2000
    failureRatePercent: 5
    serverErrorCount: 3
    cpuPercent: 80
    memoryPercent: 80
  }
}

var currentThresholds = thresholds[environment]

// Create action group only if emails are provided and no external action group
var shouldCreateActionGroup = empty(actionGroupId) && !empty(alertEmails)

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

// Action Group - Notification targets for alerts
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (shouldCreateActionGroup) {
  name: '${namePrefix}-alerts'
  location: 'global'
  tags: tags
  properties: {
    enabled: true
    groupShortName: 'SalesPortal'
    emailReceivers: [for (email, i) in alertEmails: {
      name: 'email-${i}'
      emailAddress: email
      useCommonAlertSchema: true
    }]
  }
}

// Get the action group ID to use for alerts
var effectiveActionGroupId = shouldCreateActionGroup ? actionGroup.id : actionGroupId

// Alert: High Response Time
resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-high-response-time'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when average server response time exceeds threshold'
    severity: severityLevels.warning
    enabled: true
    scopes: [
      applicationInsightsId
    ]
    evaluationFrequency: 'PT5M' // Every 5 minutes
    windowSize: 'PT15M' // 15 minute window
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighResponseTime'
          metricName: 'requests/duration'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: currentThresholds.responseTimeMs
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: empty(effectiveActionGroupId) ? [] : [
      {
        actionGroupId: effectiveActionGroupId
      }
    ]
  }
}

// Alert: High Failure Rate
resource failureRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-high-failure-rate'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when request failure rate exceeds threshold'
    severity: severityLevels.error
    enabled: true
    scopes: [
      applicationInsightsId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighFailureRate'
          metricName: 'requests/failed'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: currentThresholds.failureRatePercent
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: empty(effectiveActionGroupId) ? [] : [
      {
        actionGroupId: effectiveActionGroupId
      }
    ]
  }
}

// Alert: Server Errors (5xx)
resource serverErrorsAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-server-errors'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when server errors (5xx) exceed threshold'
    severity: severityLevels.critical
    enabled: true
    scopes: [
      applicationInsightsId
    ]
    evaluationFrequency: 'PT1M' // Every minute for critical alerts
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricName: 'exceptions/server'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: currentThresholds.serverErrorCount
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: empty(effectiveActionGroupId) ? [] : [
      {
        actionGroupId: effectiveActionGroupId
      }
    ]
  }
}

// Alert: High CPU Usage (Web App)
resource cpuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (environment != 'dev') {
  name: '${namePrefix}-high-cpu'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when CPU usage exceeds threshold'
    severity: severityLevels.warning
    enabled: true
    scopes: [
      webAppId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighCPU'
          metricName: 'CpuPercentage'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: currentThresholds.cpuPercent
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: empty(effectiveActionGroupId) ? [] : [
      {
        actionGroupId: effectiveActionGroupId
      }
    ]
  }
}

// Alert: High Memory Usage (Web App)
resource memoryAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (environment != 'dev') {
  name: '${namePrefix}-high-memory'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when memory usage exceeds threshold'
    severity: severityLevels.warning
    enabled: true
    scopes: [
      webAppId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighMemory'
          metricName: 'MemoryPercentage'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: currentThresholds.memoryPercent
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: empty(effectiveActionGroupId) ? [] : [
      {
        actionGroupId: effectiveActionGroupId
      }
    ]
  }
}

// Alert: Availability Test Failed (only if availability test exists)
resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (environment != 'dev') {
  name: '${namePrefix}-availability-failed'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when health check availability test fails'
    severity: severityLevels.critical
    enabled: true
    scopes: [
      applicationInsightsId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'AvailabilityFailed'
          metricName: 'availabilityResults/availabilityPercentage'
          metricNamespace: 'microsoft.insights/components'
          operator: 'LessThan'
          threshold: 80 // Alert if availability drops below 80%
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: empty(effectiveActionGroupId) ? [] : [
      {
        actionGroupId: effectiveActionGroupId
      }
    ]
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Action Group resource ID')
output actionGroupId string = shouldCreateActionGroup ? actionGroup.id : ''

@description('Response Time Alert resource ID')
output responseTimeAlertId string = responseTimeAlert.id

@description('Failure Rate Alert resource ID')
output failureRateAlertId string = failureRateAlert.id

@description('Server Errors Alert resource ID')
output serverErrorsAlertId string = serverErrorsAlert.id
