import { describe, it, expect } from 'vitest';
import {
  quoteCheckoutCompany,
  quotePaymentOptions,
} from '../../app/utils/quote-checkout';
import { makeQuote } from '../fixtures/quote';

describe('quoteCheckoutCompany', () => {
  const quote = (overrides = {}) =>
    makeQuote({
      company: {
        companyId: 'internal-7',
        name: 'Acme AB',
        vatNumber: '556677-8899',
      },
      billingAddress: {
        company: 'Acme AB',
        addressLine1: 'Billing 1',
        zip: '111 22',
        city: 'Stockholm',
        country: 'SE',
      },
      shippingAddress: {
        company: 'Acme AB',
        addressLine1: 'Dock 2',
        addressLine2: 'Gate 4',
        zip: '333 44',
        city: 'Göteborg',
        country: 'SE',
      },
      customer: {
        id: 'buyer@acme.test',
        firstName: 'Anna',
        lastName: 'Berg',
      },
      ...overrides,
    });

  it('carries the name and org number', () => {
    expect(quoteCheckoutCompany(quote())).toMatchObject({
      id: 'internal-7',
      name: 'Acme AB',
      vatNumber: '556677-8899',
    });
  });

  it('gives the billing address first, then the shipping address as delivery', () => {
    const addresses = quoteCheckoutCompany(quote())!.addresses!;
    expect(addresses.map((a) => a.addressType)).toEqual([
      'billing',
      'delivery',
    ]);
    expect(addresses[0]).toMatchObject({
      companyId: 'internal-7',
      company: 'Acme AB',
      addressLine1: 'Billing 1',
      zip: '111 22',
      city: 'Stockholm',
      country: 'SE',
    });
    expect(addresses[1]).toMatchObject({
      addressLine1: 'Dock 2',
      addressLine2: 'Gate 4',
      zip: '333 44',
      city: 'Göteborg',
    });
    expect(addresses[0]!.addressId).not.toBe(addresses[1]!.addressId);
  });

  it('reads a missing address field as null', () => {
    const [billing] = quoteCheckoutCompany(
      quote({ billingAddress: { addressLine1: 'Billing 1' } }),
    )!.addresses!;
    expect(billing).toMatchObject({
      email: null,
      phone: null,
      company: null,
      firstName: null,
      lastName: null,
      careOf: null,
      addressLine2: null,
      addressLine3: null,
      zip: null,
      city: null,
      region: null,
      country: null,
      addressReferenceId: null,
    });
  });

  it('leaves out an address the quotation does not have', () => {
    expect(
      quoteCheckoutCompany(
        quote({ shippingAddress: undefined }),
      )!.addresses!.map((a) => a.addressType),
    ).toEqual(['billing']);
    expect(
      quoteCheckoutCompany(
        quote({ billingAddress: undefined }),
      )!.addresses!.map((a) => a.addressType),
    ).toEqual(['delivery']);
    expect(
      quoteCheckoutCompany(
        quote({ billingAddress: undefined, shippingAddress: undefined }),
      )!.addresses,
    ).toEqual([]);
  });

  it('names the buyer from the quotation customer', () => {
    expect(quoteCheckoutCompany(quote())!.buyers).toEqual([
      expect.objectContaining({
        id: 'buyer@acme.test',
        firstName: 'Anna',
        lastName: 'Berg',
        companyId: 'internal-7',
      }),
    ]);
  });

  it('keeps a buyer with only one of the names', () => {
    expect(
      quoteCheckoutCompany(
        quote({ customer: { id: 'buyer@acme.test', lastName: 'Berg' } }),
      )!.buyers,
    ).toEqual([expect.objectContaining({ firstName: null, lastName: 'Berg' })]);
  });

  it('has no buyer without a customer, an id or a name', () => {
    expect(quoteCheckoutCompany(quote({ customer: undefined }))!.buyers).toBe(
      null,
    );
    expect(
      quoteCheckoutCompany(quote({ customer: { id: 'buyer@acme.test' } }))!
        .buyers,
    ).toBe(null);
    expect(
      quoteCheckoutCompany(quote({ customer: { firstName: 'Anna' } }))!.buyers,
    ).toBe(null);
  });

  it('reads missing company fields as null', () => {
    expect(quoteCheckoutCompany(quote({ company: {} }))).toMatchObject({
      id: '',
      name: null,
      vatNumber: null,
    });
  });

  it('gives no company for a quotation without one', () => {
    expect(quoteCheckoutCompany(quote({ company: undefined }))).toBeNull();
  });
});

describe('quotePaymentOptions', () => {
  it('has none without payment methods', () => {
    expect(
      quotePaymentOptions(makeQuote({ paymentMethods: undefined })),
    ).toEqual([]);
  });

  it('numbers the methods by position, with no fee', () => {
    expect(
      quotePaymentOptions(
        makeQuote({
          paymentMethods: [
            { id: '18', name: 'ManualInvoice', fee: 0 },
            { id: 'card', name: 'Card', fee: 12.5 },
          ],
        }),
      ),
    ).toEqual([
      {
        id: 1,
        feeIncVat: 0,
        feeExVat: 0,
        isDefault: false,
        isSelected: false,
      },
      {
        id: 2,
        feeIncVat: 0,
        feeExVat: 0,
        isDefault: false,
        isSelected: false,
      },
    ]);
  });

  it("leaves out the API's technical name", () => {
    const options = quotePaymentOptions(
      makeQuote({
        paymentMethods: [{ id: '18', name: 'ManualInvoice' }, { id: '19' }],
      }),
    );
    expect(options.map((option) => option.name)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('shows the display name Geins gives, and none for an older quotation', () => {
    const options = quotePaymentOptions(
      makeQuote({
        paymentMethods: [
          { id: '18', name: 'ManualInvoice', displayName: 'Faktura 30 dagar' },
          { id: '19', name: 'ManualInvoice' },
        ],
      }),
    );
    expect(options.map((option) => option.displayName)).toEqual([
      'Faktura 30 dagar',
      undefined,
    ]);
  });
});
