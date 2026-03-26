# ADR-013: Configurable Checkout Mode (Hosted vs Custom)

## Status

Accepted

## Context

The Geins platform provides a hosted checkout at `checkout.geins.services/{token}` that handles
payment, address collection, and order placement. Our sales-portal had a custom-built checkout
page, but it had multiple issues:

- Order body format mismatch (nested vs flat) causing 400 errors
- Order confirmation page couldn't fetch order details from Geins API
- The wiki spec says "checkout with invoice payment" — exactly what the hosted checkout provides
- Building and maintaining a custom checkout duplicates functionality Geins already provides

## Decision

Make checkout mode configurable via `checkoutMode` in tenant config:

- **`'hosted'` (default)**: Generate a token via `oms.checkout.createToken()`, redirect to
  `checkout.geins.services/{token}`. Geins handles the entire checkout flow. The token includes
  tenant branding (colors, logo, radius) so the hosted checkout matches the storefront's look.

- **`'custom'`**: Render the existing custom checkout form. This allows future customization
  beyond what the hosted checkout supports (e.g., custom payment integrations, B2B-specific
  workflows).

### Token Generation Flow

1. User clicks "Gå till kassan" → navigates to `/checkout`
2. Checkout page detects `checkoutMode === 'hosted'`
3. Shows spinner: "Omdirigerar till kassan..."
4. Calls `POST /api/checkout/token` with `{ cartId }`
5. Server generates token via SDK with branding from tenant theme
6. Client redirects to `https://checkout.geins.services/{token}`
7. After payment, Geins redirects to our `/order-confirmation` page

### Branding Mapping

| Tenant theme color  | Geins checkout style |
| ------------------- | -------------------- |
| `primary`           | `accent`             |
| `primaryForeground` | `accentForeground`   |
| `background`        | `background`         |
| `foreground`        | `foreground`         |
| `card`              | `card`               |
| `border`            | `border`             |
| Theme `radius`      | `radius`             |
| Branding `logoUrl`  | `logo`               |

## Consequences

- Default checkout requires zero configuration — works out of the box with tenant branding
- Custom checkout remains available as a fallback
- Order confirmation page works for both modes (Geins redirects with orderId in URL)
- The `HOSTED_CHECKOUT_BASE_URL` constant in `shared/constants/checkout.ts` avoids hardcoding

## References

- [Geins Checkout Token Docs](https://sdk.geins.dev/packages/oms/checkout-token)
- SDK: `oms.checkout.createToken(GenerateCheckoutTokenOptions)`
- Wiki: "Cart and checkout with invoice payment"
