# =============================================================================
# SALES PORTAL - Multi-stage Docker Build
# =============================================================================
# Optimized multi-stage build for Nuxt application
# Base image: Node.js 20 Alpine for minimal footprint
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package.json first so corepack can read the packageManager field
COPY package.json pnpm-lock.yaml ./

# Install pnpm via corepack (reads version from packageManager in package.json)
RUN corepack enable && corepack install

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Build argument for commit SHA (injected at build time)
ARG COMMIT_SHA=n/a

WORKDIR /app

# Copy package.json so corepack can read the packageManager field
COPY package.json ./

# Install pnpm via corepack
RUN corepack enable && corepack install

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set commit SHA for Nuxt build (GITHUB_SHA is what nuxt.config.ts reads)
ENV COMMIT_SHA=${COMMIT_SHA}
ENV GITHUB_SHA=${COMMIT_SHA}

# Build the Nuxt application
# This creates the .output directory with the production build
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nuxt

# Copy built application from builder stage
# Nuxt outputs to .output directory with the server and public assets
COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output

# Switch to non-root user
USER nuxt

# Expose the port Nuxt runs on
EXPOSE 3000

# Health check for container orchestration
# - start-period: Give Nuxt time to initialize before health checks begin
# - timeout: Allow more time for response during cold starts
# - retries: Be more tolerant of transient failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the Nuxt server
CMD ["node", ".output/server/index.mjs"]
