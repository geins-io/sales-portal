# CMS form widget + mailto submit

Forms on CMS-driven pages are authored in Geins Studio as a JSON page
widget and rendered by `FormWidget`. There is no server submission and
nothing is stored: the form builds a `mailto:` URL and hands it to the
mail client. The same widget backs both the apply-for-account page and
the contact page.

## How a form reaches the widget

A form arrives in the CMS area as a `JSONPageWidget`. `JsonWidget.vue`
inspects the payload: when it is form-shaped (the `isFormWidgetData`
type guard checks for a string `sendFormToEmail` and an array `fields`)
it routes to `FormWidget.vue`. Any other JSON shape falls through to the
existing `templateId` branches.

## Form shape

```ts
// shared/types/cms.ts
interface FormWidgetField {
  label: string;
  name: string;
  required: boolean;
  type: 'input' | 'email' | 'textarea' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  placeholder?: string; // select only; overrides the default prompt
  value?: string; // checkbox: submitted value; presence makes it a group option
  groupLabel?: string; // checkbox group heading, on the first box that carries one
}

interface FormWidgetData {
  sendFormToEmail: string;
  fields: FormWidgetField[];
  subject?: string; // supports {fieldName} placeholders
  submitLabel?: string; // button text; falls back to a neutral default
  templateName?: string; // CMS template name; subject fallback
}
```

## Rendering

`FormWidget` renders fields dynamically, reusing the shared
`~/components/ui` primitives (`Input`, `Label`, `Select`, `Button`):

- `input` / `email` → `Input` (email gets `type="email"`).
- `textarea` → native textarea styled to match the UI kit.
- `checkbox` → `Checkbox`. Boxes sharing a `name` and differing by `value`
  are one multi-select group; a box with no `value` stands alone (a consent
  tick, whose own `label` is the question).
- `select` → `Select`. Options prefer `field.options` when present;
  otherwise they fall back to `getCountryOptions(locale)` from
  `app/utils/country-options.ts` (full ISO 3166-1 alpha-2 list,
  localized via `Intl.DisplayNames`, exposed as a computed so it
  reacts to locale changes).

  The prompt shown before a choice follows the same branch, which is the
  point: a field carrying its own `options` gets the neutral
  `form.select_placeholder` ("Select…"), and only a field falling through to
  the country list gets `form.country_placeholder` ("Select country"). Set
  `placeholder` to override it per field — `"Välj ärendetyp"` reads better
  than a generic prompt on a support form, and it is plain text rather than a
  translation key, so a multi-locale form is better served by the default.

Validation is zod-on-blur: required fields must be non-empty, `email`
fields must parse as an address even when optional. Error messages are
i18n keys resolved at render time.

A checkbox group renders as one `fieldset` with the `groupLabel` as its
`legend`, the same shape `CheckoutShippingOptions` uses. That is not only
markup: the group is one control. Its boxes share a `name`, so they share
one validation slot, one error line and one wrapper `data-testid`. Rendering
them flat gave every box a wrapper claiming the same `name`, which duplicated
both the error and the id. Per-box identity is `name:value` — see
`checkboxKey` — and that is what the input id and the option `data-testid`
use.

`required` on a checkbox means the box has to be ticked, not merely filled:
a required standalone box is a consent tick, and a required group needs at
least one option ticked.

## Submit = mailto

On submit (after `validateAll` passes) `FormWidget` builds the URL with
`buildMailto({ recipient, subject, fields })` from `app/utils/mailto.ts`
and opens it via `safeLocationRedirect`, which is guarded on
`import.meta.client` so server renders never touch `window`.

- The recipient is placed literal per RFC 6068 (not percent-encoded),
  trimmed, and stripped of ASCII control characters.
- The subject is configured per widget via `data.subject`, so each form
  (apply, contact, ...) owns its own. It supports `{fieldName}` placeholders
  filled from the submitted values, e.g. `Account application: {company}`.
  When `subject` is unset it falls back to `templateName`, then a neutral
  translated default, never a hardcoded subject that would be wrong for a
  different form.
- The submit button label comes from `data.submitLabel`, falling back to a
  neutral translated default (`form.submit`).
- The body is one `Label: value` line per field, joined with `\r\n`.
- Empty fields are omitted, so a mostly-optional form does not report a
  column of bare `Label:` lines.
- A checkbox group reports on a single line under its `groupLabel`, with the
  ticked options comma-joined — `Interested in: Power, Monitoring` rather
  than a line per option. The label is read from whichever box in the group
  carries `groupLabel`, not from the first ticked one, so leaving that option
  unticked does not retitle the group.
- A ticked standalone box reports under its own label, with a translated
  affirmative as the value.

If no mail client opens, a fallback line `If nothing opens, email us at
{recipient}` links the recipient address directly.

## Apply-for-account page

There is no `/apply-for-account` route: the page is an ordinary CMS page
served by the catch-all and found by its `apply` tag, the same way the
contact page is. `hasFeature('applyForAccount')` gates the controls that
link to it, not the page itself. The widget supplies the entire form; there
is no server endpoint behind it. Self-registration (`/api/auth/register`, `RegisterForm`, the
`registration` feature flag) is a separate flow and is unchanged.

## Contact page

The contact page is a CMS page at slug `contact-form`. It is authored
in Geins Studio and rendered by the existing `app/pages/[...slug].vue`
catch-all route. The form is a JSON form widget inside the page, routed
by `JsonWidget` to `FormWidget`.

There is no separate `/contact` route, and nothing links to the slug
literally: `/contact-form` is one of the five literals the ESLint rule in
`eslint.config.mjs` forbids passing to `localePath` or `navigateTo`, per
ADR-021. The header topbar resolves the page by CMS tag —
`useCmsPageLink(CMS_TAGS.CONTACT_PAGE)` in
`app/components/layout/header/LayoutHeaderTopbar.vue` — and renders the
link only once it resolves. See `docs/patterns/cms-page-link.md`.

There is no `CONTACT_FORM` CMS slot. No `DEFAULT_CMS_CONFIG` seed is
needed: the page renders as an ordinary CMS page via the catch-all,
not via an area fetch.

## Related files

- `shared/types/cms.ts`: `FormWidgetData` / `FormWidgetField` types.
- `shared/constants/cms.ts`: `CMS_TAGS.APPLY_PAGE` (`'apply'`) — the tag the
  entry points resolve the page by.
- `app/composables/useCmsSlot.ts`: slot resolver.
- `app/components/cms/widgets/JsonWidget.vue`: form-shape routing.
- `app/components/cms/widgets/FormWidget.vue`: the form renderer.
- `app/utils/mailto.ts`: `buildMailto`.
- `app/utils/country-options.ts`: `getCountryOptions`.
- `app/pages/[...slug].vue`: catch-all that renders both the contact-form
  and apply CMS pages.
