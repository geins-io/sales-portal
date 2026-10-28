# Apply-for-account

The apply-for-account page is a CMS-authored form, not a server flow.
It creates no user account and stores nothing: the form is submitted as
a `mailto:` link to the address configured in the widget, and the sales
team handles the application from the resulting email.

There is no `/apply-for-account` route and no CMS slot for the page. It is an
ordinary CMS page rendered by the catch-all `app/pages/[...slug].vue`, the same
way the contact page is, and it is found by its `apply` tag
(`CMS_TAGS.APPLY_PAGE` in `shared/constants/cms.ts`). A request for the legacy
`/apply-for-account` slug is redirected to the tagged page by the semantic-slug
recovery in `server/services/url-resolver.ts`. The form itself is the generic
CMS form widget that also backs the contact page.

`hasFeature('applyForAccount')` gates the controls that link to the page, not
the page itself: with the flag off the page still renders at its own slug, but
none of the portal's own controls links to it.

See [cms-form-widget.md](./cms-form-widget.md) for the widget shape,
rendering, validation, and the mailto submit details.

## Apply link

The controls that point at this page (the topbar Apply link and the
auth-screen Apply CTA in `AuthCard.vue` and `AuthSheet.vue`) do not target a
fixed `/apply-for-account` path. They resolve the page by its
`CMS_TAGS.APPLY_PAGE` tag through `useCmsPageLink`, so a tenant with a localized
slug gets the correct localized path. When no apply page is tagged the resolver
returns no path and the control is hidden rather than linking to a slug that
404s. On the two auth screens the whole "no account?" section (divider,
business text and CTA) is hidden with it, so no text is left without a way
forward. See [cms-page-link.md](./cms-page-link.md).

Self-registration (`/api/auth/register`, `RegisterForm`, the
`registration` feature flag) is a separate flow and is unrelated to this
page.
