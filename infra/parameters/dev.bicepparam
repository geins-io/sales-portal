// =============================================================================
// SALES PORTAL - Development Environment Parameters
// =============================================================================
using '../main.bicep'

// Environment configuration
param environment = 'dev'
param location = 'westeurope'
param appName = 'sales-portal'

// GitHub Container Registry credentials (set via GitHub Actions)
param ghcrUsername = ''
param ghcrToken = ''

// Application settings - Development defaults
param geinsApiEndpoint = 'https://api.geins.io/graphql'
param storageDriver = 'fs'
param redisUrl = ''
param enableAnalytics = false
param logLevel = 'debug'
