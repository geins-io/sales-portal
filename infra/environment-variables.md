# Environment Variables Reference

This document is the **single source of truth** for all environment variables and secrets used in the Sales Portal application.

## Quick Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WHERE TO SET VARIABLES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LOCAL DEVELOPMENT        → .env file (copy from .env.example)             │
│                                                                             │
│   GITHUB SECRETS           → Repository Settings → Secrets → Actions       │
│   (sensitive values)         Used during CI/CD, passed to Bicep             │
│                                                                             │
│   GITHUB VARIABLES         → Repository Settings → Variables → Actions     │
│   (non-sensitive config)     Used during CI/CD, passed to Bicep             │
│                                                                             │
│   AZURE APP SERVICE        → DO NOT SET MANUALLY!                           │
│                              Bicep templates set these automatically        │
│                              with the correct NUXT_* prefix                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## GitHub Secrets (Required)

> **Location:** Repository → Settings → Secrets and variables → Actions → Secrets

These are **sensitive values** that must be kept secret. They are encrypted by GitHub.

| Secret                  | Required | Description                                 | How to Get                      |
| ----------------------- | :------: | ------------------------------------------- | ------------------------------- |
| `AZURE_CLIENT_ID`       |    ✅    | Service Principal App (Client) ID           | Run `pnpm infra:setup`          |
| `AZURE_TENANT_ID`       |    ✅    | Azure AD Tenant ID                          | Run `pnpm infra:setup`          |
| `AZURE_SUBSCRIPTION_ID` |    ✅    | Target Azure Subscription ID                | Run `pnpm infra:setup`          |
| `GEINS_TENANT_API_KEY`  |    ❌    | Geins Tenant API key (server-only)          | Geins admin portal              |
| `REDIS_URL`             |    ❌    | Redis/Upstash connection string             | Your Redis provider             |
| `SENTRY_DSN`            |    ❌    | Sentry DSN for error tracking (server-only) | Sentry → Project → Client Keys  |
| `SENTRY_AUTH_TOKEN`     |    ❌    | Sentry token for source map uploads         | Sentry → Settings → Auth Tokens |

### Notes on Secrets

- **AZURE\_\*** secrets are created by running `pnpm infra:setup` - the script outputs the values
- **REDIS_URL** is only needed if using Redis for storage (production)
- **SENTRY_AUTH_TOKEN** is only used at **build time** for uploading source maps

---

## GitHub Variables (Optional)

> **Location:** Repository → Settings → Secrets and variables → Actions → Variables

These are **non-sensitive configuration values** visible in the repository settings.

| Variable               | Default                        | Description                        | Options                                    |
| ---------------------- | ------------------------------ | ---------------------------------- | ------------------------------------------ |
| `GEINS_API_ENDPOINT`   | `https://api.geins.io/graphql` | Geins GraphQL API URL              | Any valid URL                              |
| `GEINS_TENANT_API_URL` | _(empty)_                      | Geins Tenant API URL (server-only) | Any valid URL                              |
| `STORAGE_DRIVER`       | `fs`                           | Storage backend for tenant config  | `memory`, `fs`, `redis`                    |
| `ENABLE_ANALYTICS`     | `false`                        | Enable client-side analytics       | `true`, `false`                            |
| `LOG_LEVEL`            | `info`                         | Server log verbosity               | `debug`, `info`, `warn`, `error`, `silent` |
| `SENTRY_ORG`           | _(empty)_                      | Sentry organization slug           | Your Sentry org name                       |
| `SENTRY_PROJECT`       | _(empty)_                      | Sentry project slug                | Your Sentry project name                   |

### Notes on Variables

- All variables have sensible defaults - only set if you need to override
- **SENTRY_ORG** and **SENTRY_PROJECT** are only used at **build time** for source map uploads
- The deploy workflow passes these to Bicep, which converts them to `NUXT_*` format in Azure

---

## Azure App Service Settings

> ⚠️ **DO NOT SET THESE MANUALLY** - They are configured automatically by the Bicep deployment.

The `deploy.yml` workflow passes GitHub variables to Bicep, which sets these in Azure App Service:

| Azure App Setting                | Source                            | Maps to nuxt.config.ts                    |
| -------------------------------- | --------------------------------- | ----------------------------------------- |
| `NODE_ENV`                       | Set by Bicep based on environment | `process.env.NODE_ENV`                    |
| `NUXT_GEINS_API_ENDPOINT`        | `vars.GEINS_API_ENDPOINT`         | `runtimeConfig.geins.apiEndpoint`         |
| `NUXT_GEINS_TENANT_API_URL`      | `vars.GEINS_TENANT_API_URL`       | `runtimeConfig.geins.tenantApiUrl`        |
| `NUXT_GEINS_TENANT_API_KEY`      | `secrets.GEINS_TENANT_API_KEY`    | `runtimeConfig.geins.tenantApiKey`        |
| `NUXT_STORAGE_DRIVER`            | `vars.STORAGE_DRIVER`             | `runtimeConfig.storage.driver`            |
| `NUXT_STORAGE_REDIS_URL`         | `secrets.REDIS_URL`               | `runtimeConfig.storage.redisUrl`          |
| `NUXT_PUBLIC_FEATURES_ANALYTICS` | `vars.ENABLE_ANALYTICS`           | `runtimeConfig.public.features.analytics` |
| `NUXT_SENTRY_DSN`                | `secrets.SENTRY_DSN`              | `runtimeConfig.sentry.dsn` (server-only)  |
| `NITRO_HOST`                     | Hardcoded `0.0.0.0`               | Required for Azure containers             |
| `NITRO_PORT`                     | Hardcoded `3000`                  | Container port                            |
| `WEBSITES_PORT`                  | Hardcoded `3000`                  | Azure port mapping                        |

### Why the NUXT\_ Prefix?

Nuxt 3 uses a specific naming convention for runtime config overrides:

```
Environment Variable              →  runtimeConfig path
────────────────────────────────────────────────────────
NUXT_API_SECRET                   →  apiSecret
NUXT_GEINS_API_ENDPOINT           →  geins.apiEndpoint
NUXT_STORAGE_REDIS_URL            →  storage.redisUrl
NUXT_SENTRY_DSN                   →  sentry.dsn (server-only)
```

**Without the `NUXT_` prefix, Nuxt ignores the variable at runtime!**

This is why the Bicep templates convert `GEINS_API_ENDPOINT` (GitHub) to `NUXT_GEINS_API_ENDPOINT` (Azure).

---

## Build-Time vs Runtime Variables

Understanding when variables are used:

| Variable             | Build-Time | Runtime | Where to Set                         |
| -------------------- | :--------: | :-----: | ------------------------------------ |
| `SENTRY_AUTH_TOKEN`  |     ✅     |   ❌    | GitHub Secrets                       |
| `SENTRY_ORG`         |     ✅     |   ❌    | GitHub Variables                     |
| `SENTRY_PROJECT`     |     ✅     |   ❌    | GitHub Variables                     |
| `SENTRY_DSN`         |     ❌     |   ✅    | GitHub Secrets → Azure (server-only) |
| `GEINS_API_ENDPOINT` |     ❌     |   ✅    | GitHub Variables → Azure             |
| `REDIS_URL`          |     ❌     |   ✅    | GitHub Secrets → Azure               |
| `STORAGE_DRIVER`     |     ❌     |   ✅    | GitHub Variables → Azure             |

**Build-time** = Used during `docker build` in GitHub Actions  
**Runtime** = Used when the app runs in Azure

---

## Environment-Specific Configuration

You can set different values per GitHub Environment (dev, staging, prod):

> **Location:** Repository → Settings → Environments → [environment name] → Environment secrets/variables

### Recommended Per-Environment Secrets

| Environment | `REDIS_URL` | `SENTRY_DSN` | Notes                         |
| ----------- | :---------: | :----------: | ----------------------------- |
| dev         |     ❌      |   Optional   | Uses memory/fs storage        |
| staging     |     ✅      |      ✅      | Production-like (server-only) |
| prod        |     ✅      |      ✅      | Full monitoring (server-only) |

---

## Complete Setup Checklist

### 1. Azure Setup (One-time)

```bash
# Creates resource groups, service principal, and federated credentials
pnpm infra:setup
```

Copy the output values for the next step.

### 2. GitHub Secrets (Required)

- [ ] `AZURE_CLIENT_ID` - From setup script output
- [ ] `AZURE_TENANT_ID` - From setup script output
- [ ] `AZURE_SUBSCRIPTION_ID` - From setup script output

### 3. GitHub Secrets (Optional)

- [ ] `GEINS_TENANT_API_KEY` - Geins Tenant API key
- [ ] `REDIS_URL` - If using Redis storage
- [ ] `SENTRY_DSN` - If using Sentry error tracking (server-side only)
- [ ] `SENTRY_AUTH_TOKEN` - If uploading source maps to Sentry

### 4. GitHub Variables (Optional)

- [ ] `GEINS_API_ENDPOINT` - If different from default
- [ ] `GEINS_TENANT_API_URL` - Geins Tenant API URL
- [ ] `STORAGE_DRIVER` - Set to `redis` for production
- [ ] `ENABLE_ANALYTICS` - Set to `true` if needed
- [ ] `LOG_LEVEL` - Adjust as needed (`silent` to disable all logging)
- [ ] `SENTRY_ORG` - If using Sentry
- [ ] `SENTRY_PROJECT` - If using Sentry

### 5. GitHub Environments

- [ ] Create `dev` environment
- [ ] Create `staging` environment
- [ ] Create `prod` environment (with required reviewers)
- [ ] Create `prod-swap` environment (with required reviewers)

---

## Verification

After deploying, verify your configuration is correct:

```bash
# Check Azure app settings
az webapp config appsettings list \
  --resource-group rg-sales-portal-dev \
  --name sales-portal-dev-app \
  --output table

# Should show NUXT_* prefixed variables
```

Or hit the health endpoint with your secret:

```
https://your-app.azurewebsites.net/api/health?key=YOUR_HEALTH_SECRET
```

This returns the full runtime config so you can verify values are being picked up correctly.

---

## Troubleshooting

### Variables not working in Azure?

1. **Check the prefix** - Azure vars must start with `NUXT_` for Nuxt to pick them up
2. **Restart the app** - Azure may cache old environment values
3. **Check the Bicep output** - Ensure deploy workflow completed successfully
4. **View app settings** - Use `az webapp config appsettings list` to see actual values

### Values showing defaults instead of Azure values?

The Bicep template converts GitHub variables to `NUXT_*` format. If you see default values:

1. Check GitHub Variables/Secrets are set correctly
2. Re-run the deploy workflow
3. Verify the Bicep deployment succeeded

### Sentry source maps not uploading?

Source maps are uploaded during Docker build. Check:

1. `SENTRY_AUTH_TOKEN` is set in GitHub Secrets
2. `SENTRY_ORG` and `SENTRY_PROJECT` are set in GitHub Variables
3. Build logs show source map upload step
