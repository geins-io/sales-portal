# Lessons Learned

Incidents that cost real time, and what changed because of them. This is not a decision log —
see [ADRs](adr/) for why the architecture is the way it is. This is the record of what broke,
why, and which rule exists as a result.

Add an entry when a bug takes more than a day to diagnose, reaches production, or turns out to
have a cause that was not obvious from the symptom. Keep it short: symptom, root cause, fix,
and where the rule lives now.

---

## Locale had three competing sources of truth

**Symptom.** Zero products returned from the API. Wrong translations. Raw i18n keys rendered in
the UI. The locale switcher displayed a different locale than the page was actually using.

**Root cause.** Three independent places decided the locale and fought each other: a Nitro plugin
hardcoded `'en'`, i18n was configured with `defaultLocale: 'en'`, and `detectBrowserLanguage`
overwrote the locale cookie behind both. Separately, short locale codes (`'sv'`) were being passed
to GraphQL, which needs BCP-47 (`'sv-SE'`) and silently returns zero results rather than erroring.

**Fix.** Disabled `detectBrowserLanguage`, corrected the default locale, introduced
`ensureBcp47Locale()` as the single gatekeeper at the API boundary, and added a `SupportedLocale`
type so locale strings cannot be invented ad hoc.

**Where the rule lives now.** [conventions/ssr.md](conventions/ssr.md) and
[conventions/i18n.md](conventions/i18n.md).

---

## SSR crashed on hard refresh

**Symptom.** Category pages returned a 500 on hard refresh, while working fine when navigated to
from within the app. Error: `Cannot convert undefined or null to object`.

**Root cause.** Templates and computed properties accessed async data without null guards. SSR
renders the template _before_ `useFetch`/`useAsyncData` resolves, so what is merely `undefined`
for a moment on the client is fatal on the server. A `window.scrollTo` call with no browser-API
guard failed the same way.

**Fix.** Optional chaining and nullish coalescing on every template expression reading async data,
`import.meta.client` guards around browser APIs, and SSR-safety tests that render before resolution.

**Where the rule lives now.** [conventions/ssr.md](conventions/ssr.md). Browser APIs have
SSR-safe helpers in `app/utils/client-helpers.ts` — prefer those over hand-rolled guards.

---

## Locale and market state: thirteen problems, one root cause

**Symptom.** Accumulated over months — cache keys that mixed locales, race conditions on first
paint, validation happening in the wrong layer, and consumers disagreeing about the current market.

**Root cause.** Parsing, validation and BCP-47 expansion were spread across a Nitro plugin, route
middleware, server utils and a composable, with no validated result object passed between them.
Every consumer re-derived the locale from cookies independently, so every consumer could be wrong
in a different way.

**Fix.** A single `ResolvedLocaleMarket` object, produced once and read everywhere, flowing through
`event.context.resolvedLocaleMarket`. Layered so each stage has exactly one job: the first plugin
parses without validating, the tenant-context plugin validates against tenant config, and consumers
only read.

**Where the rule lives now.** [conventions/ssr.md](conventions/ssr.md) and
[ADR-019](adr/019-bulletproof-routing.md). Never read locale or market from cookies in server code
when `resolvedLocaleMarket` is available.

---

## Casts hid missing SDK types

**Symptom.** Six `as any` / `as Record<string, unknown>` casts accumulated in one feature, all to
reach fields the GraphQL fragments genuinely returned.

**Root cause.** The Geins SDK types lack fields the queries select. Casting made the code compile
and moved the problem to whoever read it next.

**Fix.** Extended the types properly in `shared/types/commerce.ts` and removed every cast.

**Where the rule lives now.** Enforced, not just documented: `@typescript-eslint/no-explicit-any`
and `ban-ts-comment` are errors in `eslint.config.mjs`. When SDK types are incomplete, extend them.

---

## The same logic implemented five times

**Symptom.** Roughly twenty lines of identical computed properties in both the cart drawer and the
cart page, and a campaign-visibility filter reimplemented in five components.

**Root cause.** Each component was built in isolation with no cross-component check for existing
logic.

**Fix.** Moved shared derivations to cart store getters and extracted a
`filterVisibleCampaigns()` utility.

**Where the rule lives now.** Before adding logic to a _second_ component, check whether it already
exists. If it does, extract to a store getter, composable, or utility.

---

## Things that worked, worth repeating

**Glob-based test routing.** A hardcoded 65-entry list of test files decided which tier each test
ran in. Replacing it with glob-based routing removed the maintenance burden and immediately
surfaced four component tests that had been running in the wrong tier. See
[testing.md](testing.md).

**Check what the API already does before planning around it.** One feature was scoped as a
cross-repo effort requiring SDK changes; a look at the actual GraphQL schema showed the field was
already supported. The work collapsed to a handful of small changes. Read the schema before
designing around a perceived gap.
