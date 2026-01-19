// =============================================================================
// SALES PORTAL - Production Environment Parameters
// =============================================================================
using '../main.bicep'

// Environment configuration
param environment = 'prod'
param location = 'westeurope'
param appName = 'sales-portal'

// Container image (set at deployment time via GitHub Actions)
param containerImage = 'ghcr.io/geins-io/sales-portal:latest'

// GitHub Container Registry credentials (set via GitHub Actions)
param ghcrUsername = ''
param ghcrToken = ''

// Application settings - Production configuration
param geinsApiKey = ''
param geinsApiEndpoint = 'https://api.geins.io/graphql'
param storageDriver = 'redis'
param redisUrl = ''
param enableAnalytics = true
param logLevel = 'warn'
