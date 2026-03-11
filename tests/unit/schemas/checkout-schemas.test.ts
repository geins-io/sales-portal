import { describe, it, expect } from 'vitest';
import {
  CheckoutAddressSchema,
  GetCheckoutSchema,
  PlaceOrderSchema,
  ValidateOrderSchema,
  CheckoutSummarySchema,
} from '~~/server/schemas/api-input';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validAddress = {
  firstName: 'Anna',
  lastName: 'Svensson',
  addressLine1: 'Storgatan 1',
  city: 'Stockholm',
  country: 'SE',
  zip: '11122',
};

const fullAddress = {
  ...validAddress,
  addressLine2: 'Lgh 1001',
  addressLine3: 'Box 123',
  entryCode: '1234',
  careOf: 'Erik Svensson',
  state: 'Stockholm',
  company: 'Acme AB',
  mobile: '+46701234567',
  phone: '+4681234567',
};

// ---------------------------------------------------------------------------
// CheckoutAddressSchema
// ---------------------------------------------------------------------------

describe('CheckoutAddressSchema', () => {
  it('accepts valid full address', () => {
    const result = CheckoutAddressSchema.safeParse(fullAddress);
    expect(result.success).toBe(true);
  });

  it('accepts minimal address', () => {
    const result = CheckoutAddressSchema.safeParse(validAddress);
    expect(result.success).toBe(true);
  });

  it('rejects missing firstName', () => {
    const { firstName: _, ...noFirst } = validAddress;
    const result = CheckoutAddressSchema.safeParse(noFirst);
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = CheckoutAddressSchema.safeParse({
      ...validAddress,
      firstName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing city', () => {
    const { city: _, ...noCity } = validAddress;
    const result = CheckoutAddressSchema.safeParse(noCity);
    expect(result.success).toBe(false);
  });

  it('rejects missing country', () => {
    const { country: _, ...noCountry } = validAddress;
    const result = CheckoutAddressSchema.safeParse(noCountry);
    expect(result.success).toBe(false);
  });

  it('rejects missing zip', () => {
    const { zip: _, ...noZip } = validAddress;
    const result = CheckoutAddressSchema.safeParse(noZip);
    expect(result.success).toBe(false);
  });

  it('rejects addressLine1 exceeding max length', () => {
    const result = CheckoutAddressSchema.safeParse({
      ...validAddress,
      addressLine1: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects firstName exceeding max length', () => {
    const result = CheckoutAddressSchema.safeParse({
      ...validAddress,
      firstName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PlaceOrderSchema
// ---------------------------------------------------------------------------

describe('PlaceOrderSchema', () => {
  const validOrder = {
    cartId: 'cart-123',
    paymentId: 1,
    shippingId: 2,
    email: 'anna@example.com',
    billingAddress: validAddress,
  };

  it('accepts valid order', () => {
    const result = PlaceOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it('accepts order with all optional fields', () => {
    const result = PlaceOrderSchema.safeParse({
      ...validOrder,
      identityNumber: '19900101-1234',
      message: 'Please leave at door',
      acceptedConsents: ['marketing', 'terms'],
      shippingAddress: fullAddress,
      customerType: 'PERSON',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing cartId', () => {
    const { cartId: _, ...noCartId } = validOrder;
    const result = PlaceOrderSchema.safeParse(noCartId);
    expect(result.success).toBe(false);
  });

  it('rejects empty cartId', () => {
    const result = PlaceOrderSchema.safeParse({ ...validOrder, cartId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = PlaceOrderSchema.safeParse({
      ...validOrder,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const { email: _, ...noEmail } = validOrder;
    const result = PlaceOrderSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it('rejects missing billingAddress', () => {
    const { billingAddress: _, ...noBilling } = validOrder;
    const result = PlaceOrderSchema.safeParse(noBilling);
    expect(result.success).toBe(false);
  });

  it('accepts without shippingAddress', () => {
    const result = PlaceOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shippingAddress).toBeUndefined();
    }
  });

  it('accepts empty acceptedConsents array', () => {
    const result = PlaceOrderSchema.safeParse({
      ...validOrder,
      acceptedConsents: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects message exceeding max length', () => {
    const result = PlaceOrderSchema.safeParse({
      ...validOrder,
      message: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ValidateOrderSchema
// ---------------------------------------------------------------------------

describe('ValidateOrderSchema', () => {
  it('accepts valid input with cartId and email', () => {
    const result = ValidateOrderSchema.safeParse({
      cartId: 'cart-456',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input without email', () => {
    const result = ValidateOrderSchema.safeParse({ cartId: 'cart-456' });
    expect(result.success).toBe(true);
  });

  it('rejects missing cartId', () => {
    const result = ValidateOrderSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty cartId', () => {
    const result = ValidateOrderSchema.safeParse({ cartId: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GetCheckoutSchema
// ---------------------------------------------------------------------------

describe('GetCheckoutSchema', () => {
  it('accepts valid cartId', () => {
    const result = GetCheckoutSchema.safeParse({ cartId: 'cart-789' });
    expect(result.success).toBe(true);
  });

  it('rejects empty cartId', () => {
    const result = GetCheckoutSchema.safeParse({ cartId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing cartId', () => {
    const result = GetCheckoutSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CheckoutSummarySchema
// ---------------------------------------------------------------------------

describe('CheckoutSummarySchema', () => {
  it('accepts valid input', () => {
    const result = CheckoutSummarySchema.safeParse({
      orderId: 'order-001',
      paymentMethod: 'klarna',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing orderId', () => {
    const result = CheckoutSummarySchema.safeParse({ paymentMethod: 'klarna' });
    expect(result.success).toBe(false);
  });

  it('rejects missing paymentMethod', () => {
    const result = CheckoutSummarySchema.safeParse({ orderId: 'order-001' });
    expect(result.success).toBe(false);
  });

  it('rejects empty orderId', () => {
    const result = CheckoutSummarySchema.safeParse({
      orderId: '',
      paymentMethod: 'klarna',
    });
    expect(result.success).toBe(false);
  });
});
