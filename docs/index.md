---
layout: home

hero:
  name: Sales Portal
  text: Multi-tenant Storefront Application
  tagline: Build beautiful, customizable storefronts with Nuxt 4, Vue 3, and Tailwind CSS
  image:
    src: /logo.svg
    alt: Sales Portal
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/litium/sales-portal

features:
  - icon: 🏢
    title: Multi-Tenant Architecture
    details: Single deployment serves multiple tenants based on hostname. Each tenant gets their own branding, theme, and configuration.
  - icon: 🎨
    title: Self-Service Theming
    details: Tenants can customize their appearance with CSS variables without code changes. Full design token support via Tailwind CSS 4.
  - icon: ⚡
    title: Modern Tech Stack
    details: Built on Nuxt 4, Vue 3, shadcn-vue, and Tailwind CSS 4. Full TypeScript support throughout.
  - icon: 🔧
    title: Developer Experience
    details: ESLint, Prettier, Husky hooks, comprehensive testing with Vitest and Playwright.
  - icon: 📦
    title: Component Library
    details: Accessible UI components powered by shadcn-vue and Reka UI. Easy to extend and customize.
  - icon: 🚀
    title: Production Ready
    details: Managed hosting with infrastructure-as-code. Azure deployment support with Application Insights monitoring.
---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/litium/sales-portal.git

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Overview

The Sales Portal is a multi-tenant storefront application built on Nuxt 4, designed to serve multiple merchants/brands from a single codebase. Each tenant can have their own:

- **Branding** — logos, colors, typography
- **Theme** — complete visual customization via CSS variables
- **Configuration** — features, settings, integrations
- **Content** — via CMS integration

## Documentation

<div class="tip custom-block" style="padding-top: 8px">

Ready to dive in? Start with the [Getting Started Guide](/guide/getting-started) to set up your development environment.

</div>

For architecture details, see the [Architecture Overview](/architecture).

For testing guidance, see the [Testing Guide](/testing).
