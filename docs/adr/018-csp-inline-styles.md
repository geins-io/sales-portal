---
title: CSP allows inline styles, keeps scripts nonce-strict
status: accepted
created: 2026-06-03
tags: [security, csp, styles, safari, tenant, theme]
---

# ADR-018: CSP allows inline styles, keeps scripts nonce-strict

## Context

The production Content-Security-Policy gated styles with a nonce plus a small
hash allowlist (`style-src 'self' 'nonce-...' 'unsafe-hashes' 'sha256-...'`).
This broke styling in Safari while looking fine in Chrome, in two ways:

- The tenant theme is injected as an inline `<style>`. nuxt-security adds the
  request nonce, but the tag briefly shipped with a duplicate nonce attribute;
  WebKit treats a duplicated nonce as invalid and refuses the stylesheet, so
  the store settings surface colors (top bar, buttons, footer) disappeared.
- Vue and radix-vue set inline `style="..."` attributes at runtime for
  positioning, transitions, and scroll-lock. Their values are dynamic, so a
  fixed hash can never cover them. WebKit enforces `style-src-attr` strictly
  and dropped them, breaking positioned UI and spamming the console.

A nonce cannot solve either case: an SSR nonce does not propagate to
client-injected styles, and inline style attributes cannot carry a nonce at
all. Any policy short of `'unsafe-inline'` for styles leaves a class of inline
styles that silently fails in WebKit. Chromium is more lenient, so a
Chromium-only review never sees it.

## Decision

Allow inline styles wholesale and keep script execution locked down:

```
style-src  'self' 'unsafe-inline' https://fonts.googleapis.com
script-src 'self' 'strict-dynamic' 'nonce-{{nonce}}'
```

The style nonce, `'unsafe-hashes'`, and the per-value style hashes are removed.
`script-src` is unchanged: scripts still require a nonce and `'unsafe-inline'`
is never honored for scripts.

A served-policy regression guard (`tests/e2e/csp-policy.spec.ts`, run in CI)
asserts `style-src` allows `'unsafe-inline'` and uses no style nonce/hash, and
that `script-src` stays nonce-based, so the policy cannot silently revert.

## Consequences

- Inline styles (element or attribute, server-rendered or client-injected)
  render in every browser, including Safari. The class of bug is closed.
- The brittle hash allowlist is gone; new dynamic inline styles no longer need
  a CSP change.
- We lose CSP protection against CSS-injection (for example selector-based data
  exfiltration or UI redressing). This is an accepted, low risk: it requires an
  HTML-injection foothold, and script execution — the high-value target — stays
  protected by the strict nonce-based `script-src`.
- Inline event handlers remain blocked by `script-src-attr 'none'`; that is a
  separate concern and is intentionally not loosened here.
