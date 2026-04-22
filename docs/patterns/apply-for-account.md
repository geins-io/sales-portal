# Apply-for-account: two-step register + promote

Geins has no single endpoint that creates a B2B (`ORGANIZATION`) customer.
The `apply-for-account` flow composes two calls:

1. **`userService.register`** → creates the user as a `PERSON` with
   `username` + `password` + an `address` containing company metadata.
2. **`userService.updateUser`** with the fresh token → promotes the
   `customerType` from `PERSON` to `ORGANIZATION`.

After step 2 the user is authenticated (cookies set) but not yet linked to
a company record in Geins Studio — that linking is a manual step the
sales team performs using the `organizationNumber` we log at info level.

## Data flow

```
ApplyForAccountForm
    │
    ▼  POST /api/apply/submit  (zod-validated body)
    │
    ▼  applyForAccountRateLimiter.check
    │
    ▼  userService.register({username,password}, {address})   → PERSON + tokens
    │
    ▼  userService.updateUser({customerType:ORGANIZATION,…})  → ORGANIZATION
    │
    ▼  setAuthCookies  (user is now logged in)
    │
    ▼  logger.info('Apply-for-account approved', {email, organizationNumber, …})
    │
    └──► redirect to /{market}/{locale}/portal?applied=1
              (PortalPendingApprovalBanner shows the "pending approval" notice)
```

## Why the manual linking step

The wiki (`local-docs/litium-wiki/business/packaging/features/sales-portal.md`)
lists "Business account application" as a first-class feature, separate
from "Login". Kristian confirmed at the 2026-04-17 meeting that company
→ organization linking is done in Geins Studio by the sales team — there
is no API for it. The storefront's job ends when the user record is
created and promoted.

## Error handling

| Failure                                            | Response           | Logging                                                                         |
| -------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| Rate limit exceeded                                | `429 RATE_LIMITED` | —                                                                               |
| Zod validation                                     | `400`              | —                                                                               |
| `register` returns `succeeded: false` or no tokens | `400 BAD_REQUEST`  | —                                                                               |
| `updateUser` throws after `register` succeeded     | `400 BAD_REQUEST`  | `logger.warn` with `email` + `organizationNumber` so sales can promote manually |

We never log `password` or `acceptTerms`.

## Related files

- `server/api/apply/submit.post.ts` — endpoint.
- `server/services/user.ts` — `register` + `updateUser` wrappers.
- `server/schemas/api-input.ts` — `ApplyForAccountSchema`.
- `app/components/apply/ApplyForAccountForm.vue` — form.
- `app/components/portal/PortalPendingApprovalBanner.vue` — post-submit banner.
- `app/pages/portal/index.vue` — banner mount point.
- `local-docs/KRISTIAN-MEETING-20260417.md` — decision source.
