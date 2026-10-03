# Apply-for-account

The apply-for-account page is a CMS-authored form, not a server flow.
It creates no user account and stores nothing: the form is submitted as
a `mailto:` link to the address configured in the widget, and the sales
team handles the application from the resulting email.

There is no `/apply-for-account` route. The page is an ordinary CMS page
rendered by the catch-all (`app/pages/[...slug].vue`), exactly like the
contact page, and it carries the `apply` tag so the controls below can find
it. The form itself is the generic CMS form widget that backs both.

Because it is a CMS page rather than a route, `hasFeature('applyForAccount')`
does not 404 anything — it gates the _controls that link here_, listed under
Apply link. A tenant with the feature on but no tagged page simply shows no
entry points.

See [cms-form-widget.md](./cms-form-widget.md) for the widget shape,
rendering, validation, and the mailto submit details.

## Apply link

The controls that point at this page (the topbar Apply link and the
auth-screen Apply CTA in `AuthCard.vue` and `AuthSheet.vue`) do not target a
fixed `/apply-for-account` path. They resolve the page by its
`CMS_TAGS.APPLY_PAGE` tag through `useCmsPageLink`, so a tenant with a localized
slug gets the correct localized path. When no apply page is tagged the resolver
returns no path and the control is hidden rather than linking to a slug that
404s. See [cms-page-link.md](./cms-page-link.md).

Self-registration (`/api/auth/register`, `RegisterForm`, the
`registration` feature flag) is a separate flow and is unrelated to this
page.
