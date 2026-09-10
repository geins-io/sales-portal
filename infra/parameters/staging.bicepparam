// =============================================================================
// SALES PORTAL - Staging Environment Parameters
// =============================================================================
using '../main.bicep'

// Environment configuration
param environment = 'staging'
param location = 'westeurope'
param appName = 'sales-portal'

// GitHub Container Registry credentials (set via GitHub Actions)
param ghcrUsername = ''
param ghcrToken = ''

// Application settings - Staging configuration
param geinsApiEndpoint = 'https://api.geins.io/graphql'
param storageDriver = 'redis'
param redisUrl = ''
param enableAnalytics = false
param logLevel = 'info'
