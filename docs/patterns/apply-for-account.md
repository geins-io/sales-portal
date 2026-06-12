# Apply-for-account

The apply-for-account page is a CMS-authored form, not a server flow.
It creates no user account and stores nothing: the form is submitted as
a `mailto:` link to the address configured in the widget, and the sales
team handles the application from the resulting email.

`app/pages/apply-for-account.vue` keeps its `hasFeature('applyForAccount')`
404 gate and renders the CMS area for the `APPLY_FOR_ACCOUNT` slot. The
form itself is the generic CMS form widget that also backs the contact
page (the `contact-form` CMS page rendered by the catch-all route).

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
