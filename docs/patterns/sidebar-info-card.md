# Sidebar Info Card

A compact bordered card that shows a piece of read-only reference data (label + value, optionally with a leading icon) inside a detail-page sidebar.

## When to use

- Sidebar blocks on detail pages (quotations, orders) that display static context — dates, contacts, addresses, totals.
- NOT for actionable content. If the block has buttons (accept, decline, pay, cancel), use a different container — info cards are read-only.

## Class set

```
Container (with icon):
<div class="border-border flex items-start gap-3 rounded-lg border p-4">

Container (no icon):
<div class="border-border rounded-lg border p-4 space-y-1">

Icon:
<Icon name="lucide:..." class="text-muted-foreground mt-0.5 size-4 shrink-0" />

Text wrapper (inside the icon variant):
<div class="space-y-1">

Label:
<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">

Value:
<p class="text-sm font-medium">

Secondary value:
<p class="text-muted-foreground text-sm">
```

## Minimal example

With icon (single label + value):

```vue
<div class="border-border flex items-start gap-3 rounded-lg border p-4">
  <Icon
    name="lucide:calendar"
    class="text-muted-foreground mt-0.5 size-4 shrink-0"
  />
  <div class="space-y-1">
    <p
      class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
    >
      {{ t('portal.quotations.expires_at') }}
    </p>
    <p class="text-sm font-medium">{{ formatDate(quote.expiresAt) }}</p>
  </div>
</div>
```

Without icon (label + values list):

```vue
<div class="border-border space-y-1 rounded-lg border p-4">
  <p
    class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
  >
    {{ t('portal.quotations.customer_info') }}
  </p>
  <p class="text-sm font-medium">{{ quote.company.name }}</p>
  <p class="text-muted-foreground text-sm">
    {{ t('portal.quotations.org_number') }}: {{ quote.company.companyId }}
  </p>
</div>
```

## Variants

- **With icon** — single label + value, leading `lucide:calendar` / `lucide:clock` / `lucide:user`. Use when the card carries one piece of information and the icon aids scannability.
- **Label-only** — no icon, single label + value. Use when space is tight.
- **Values list** — no icon, label followed by 2+ stacked values (primary + secondary lines). Use for addresses, customer info, multi-field contacts.

## Call sites

- `app/pages/portal/quotations/[id].vue` — `expires_at`, `payment_terms`, `sale_contact`, `customer_info`, `invoice_address`, `delivery_address`
- `app/pages/portal/orders/[id].vue` — `billing-address`, `shipping-address`
