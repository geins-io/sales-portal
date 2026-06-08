# Apply-for-account

The apply-for-account page is a CMS-authored form, not a server flow.
It creates no user account and stores nothing: the form is submitted as
a `mailto:` link to the address configured in the widget, and the sales
team handles the application from the resulting email.

`app/pages/apply-for-account.vue` keeps its `hasFeature('applyForAccount')`
404 gate and renders the CMS area for the `APPLY_FOR_ACCOUNT` slot. The
form itself is the generic CMS form widget that also backs the contact
form.

See [cms-form-widget.md](./cms-form-widget.md) for the widget shape,
rendering, validation, and the mailto submit details.

Self-registration (`/api/auth/register`, `RegisterForm`, the
`registration` feature flag) is a separate flow and is unrelated to this
page.
