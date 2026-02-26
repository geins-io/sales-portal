---
title: CMS page layout variants driven by pageArea
status: accepted
created: 2026-02-26
author: '@alihalaki'
tags: [cms, layout, navigation]
---

# ADR-012: CMS Page Layout Variants

## Context

CMS pages from the Geins API include a `pageArea` field (`{ id, name, index }`) that associates a page with a menu location. Info pages (e.g., About Us, Contact, FAQ) typically belong to a page area with a sidebar navigation menu, while landing pages and marketing pages are full-width.

We needed a way to render different layouts per page based on CMS metadata.

## Decision

Layout selection happens in `Content.vue` (page-level), not via Nuxt layouts (route-level).

- **`pageArea` present** — sidebar layout: `PageSidebarNav` (fetches menu by `pageArea.name`) + content area side-by-side
- **No `pageArea`** — full-width layout: content area only

We chose this over Nuxt layout variants because:

1. Layout is driven by CMS data (async), not route config (static)
2. `setPageLayout()` is awkward with async data fetching
3. Keeps the change localized — `[...slug].vue` doesn't need to know about layout

Sidebar menu location is dynamic — whatever `pageArea.name` returns, that menu is fetched. No hardcoded location IDs.

RTL support via Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start`/`end`).

## Consequences

**Good:**

- Zero changes to route resolution or catch-all page
- Dynamic — new page areas in CMS automatically get sidebar layouts
- RTL-ready out of the box
- Mobile collapses sidebar to accordion above content

**Bad:**

- Two useFetch calls for sidebar pages (page + menu) — acceptable, both are cached and deduped
- If a page area's menu is empty, the sidebar renders nothing (graceful degradation)
