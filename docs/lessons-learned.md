# Lessons Learned

Incidents that cost real time, and what changed because of them. This is not a decision log —
see [ADRs](adr/README.md) for why the architecture is the way it is. This is the record of what broke,
why, and which rule exists as a result.

Add an entry when a bug takes more than a day to diagnose, reaches production, or turns out to
have a cause that was not obvious from the symptom. Keep it short: symptom, root cause, fix,
and where the rule lives now.

---

## A shared account's credentials sat in the same env vars as the app's own fallback

**Symptom.** A live merchant's real Geins credentials (API key, account name, channel) were sitting
in `GEINS_API_KEY` / `GEINS_ACCOUNT_NAME` / `GEINS_CHANNEL` in a local `.env`. Two unrelated things
read those exact names: the app's own generic fallback for a tenant that fails to resolve
(`defaultGeinsSettings()` in `server/utils/tenant.ts`), and an integration suite that legitimately
needed a real account to run live queries against. Whichever value you put there broke one purpose
or the other. A separate deployment on a shared hosting environment hit the identical collision.

**Root cause.** Two callers with genuinely different needs — a generic safety net and a real
account's live credentials — sharing one env var namespace. The stored value was also wrong on its
own terms: `GEINS_CHANNEL` held the platform's combined `"channelId|tld"` format instead of the
bare channel id the app expects, a documented convention (`transformGeinsSettings()`,
[ADR-007](adr/007-tenant-config-schema-service-layer.md)) simply not followed there. And
`GEINS_ENVIRONMENT` carried another product's `'dev'`/`'qa'`/`'prod'` names instead of this app's
`'production'`/`'staging'`, which `mapEnvironment()` in `server/services/_sdk.ts` silently
defaulted to `'prod'` for any unrecognized value — the opposite of a safe fallback for a value that
ultimately comes from KV storage through an unvalidated type assertion.

**Fix.** `mapEnvironment()` throws on an unrecognized environment instead of defaulting to
`'prod'`, and the error carries an identifiable code so the call sites can tell it apart from their
own failure cases. `resolveDefaultGeinsEnvironment()` applies the same rule to the
`GEINS_ENVIRONMENT` variable itself.

**Where the rule lives now.** A test fixture's real third-party credentials must never share an env
var name with the app's own runtime config, even when both happen to read the same platform
account — colliding names mean any value chosen is wrong for one of the two purposes. Test
credentials belong in their own namespace. See
[docs/guide/multi-tenant.md](guide/multi-tenant.md) for the tenant-config side of this.

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

## One tenant name, five hostnames, and a fallback that hid the consequence

**Symptom.** The E2E suite failed on roughly 82 specs on a clean checkout while CI reported green
on the same commit. Neither number was informative.

**Root cause.** Two things compounding. The legacy test tenant's name named four different things
across five domain endings — a tenant registered in the merchant API, fixtures written at
dev-server startup, filler strings in unit tests, and the registered tenant's own aliases — and
nothing in a running system distinguishes them. Separately, an auto-create fallback (since removed)
fabricated a tenant for any hostname it could not find, so a hostname mismatch, a missing credential
and an unreachable merchant API all produced the same result: a storefront that rendered, answered
health checks and contained nothing.

**Fix.** The suite now asserts behaviour derived from tenant config rather than one tenant's
settings hardcoded as application behaviour. That surfaced two genuine product bugs the
environmental noise had been hiding.

**Where the rule lives now.** A fixture must not borrow the id or hostname of anything real — where
two mechanisms can supply the same record, nothing tells a reader which one they are looking at.
And a fallback that cannot fail cannot verify: the run that gates a merge is the one that needs it
off. Local resolution, and what each run command implies, is in
[guide/multi-tenant.md](guide/multi-tenant.md#local-development).

---

## A self-fetch with no Host header resolved a real tenant

SSR self-fetches carried only `cookie`; h3 fell back to `localhost`, which the merchant API maps
to a live tenant, so `/api/auth/me` ran with another tenant's credentials and nothing failed.
Rule: `internalFetch` (Nuxt's request-bound fetch) for every own-route call; see [patterns/internal-fetch.md](patterns/internal-fetch.md).

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
