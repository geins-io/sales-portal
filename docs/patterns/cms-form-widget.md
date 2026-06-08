# CMS form widget + mailto submit

Forms on CMS-driven pages are authored in Geins Studio as a JSON page
widget and rendered by `FormWidget`. There is no server submission and
nothing is stored: the form builds a `mailto:` URL and hands it to the
mail client. The same widget backs both the apply-for-account page and
the contact form.

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
  type: 'input' | 'email' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
}

interface FormWidgetData {
  sendFormToEmail: string;
  fields: FormWidgetField[];
}
```

## Rendering

`FormWidget` renders fields dynamically, reusing the shared
`~/components/ui` primitives (`Input`, `Label`, `Select`, `Button`):

- `input` / `email` → `Input` (email gets `type="email"`).
- `textarea` → native textarea styled to match the UI kit.
- `select` → `Select`. Options prefer `field.options` when present;
  otherwise they fall back to `getCountryOptions(locale)` from
  `app/utils/country-options.ts` (full ISO 3166-1 alpha-2 list,
  localized via `Intl.DisplayNames`, exposed as a computed so it
  reacts to locale changes).

Validation is zod-on-blur: required fields must be non-empty, `email`
fields must parse as an address even when optional. Error messages are
i18n keys resolved at render time.

## Submit = mailto

On submit (after `validateAll` passes) `FormWidget` builds the URL with
`buildMailto({ recipient, subject, fields })` from `app/utils/mailto.ts`
and opens it via `safeLocationRedirect`, which is guarded on
`import.meta.client` so server renders never touch `window`.

- The recipient is placed literal per RFC 6068 (not percent-encoded),
  trimmed, and stripped of ASCII control characters.
- The subject for the apply page is `Account application: {Company name}`
  where the company value is taken from the first field whose name
  matches a known company token, falling back to the first field.
- The body is one `Label: value` line per field, joined with `\r\n`.

If no mail client opens, a fallback line `If nothing opens, email us at
{recipient}` links the recipient address directly.

## Apply-for-account page

`app/pages/apply-for-account.vue` keeps its `hasFeature('applyForAccount')`
404 gate and renders only the CMS area for the `APPLY_FOR_ACCOUNT` slot.
The widget supplies the entire form; there is no server endpoint behind
it. Self-registration (`/api/auth/register`, `RegisterForm`, the
`registration` feature flag) is a separate flow and is unchanged.

## Related files

- `shared/types/cms.ts`: `FormWidgetData` / `FormWidgetField` types.
- `app/components/cms/widgets/JsonWidget.vue`: form-shape routing.
- `app/components/cms/widgets/FormWidget.vue`: the form renderer.
- `app/utils/mailto.ts`: `buildMailto`.
- `app/utils/country-options.ts`: `getCountryOptions`.
- `app/pages/apply-for-account.vue`: apply page (feature-gated CMS area).
