import type { PaymentOptionType } from '#shared/types/commerce';
import type {
  Company,
  CompanyAddress,
  CompanyBuyer,
} from '#shared/types/company';
import type { Quote, QuoteAddress } from '#shared/types/quote';

function companyAddress(
  address: QuoteAddress,
  addressType: 'billing' | 'delivery',
  companyId: string | null,
): CompanyAddress {
  return {
    addressId: `quote-${addressType}`,
    companyId,
    email: address.email ?? null,
    phone: address.phone ?? null,
    company: address.company ?? null,
    firstName: address.firstName ?? null,
    lastName: address.lastName ?? null,
    careOf: null,
    addressLine1: address.addressLine1 ?? null,
    addressLine2: address.addressLine2 ?? null,
    addressLine3: address.addressLine3 ?? null,
    zip: address.zip ?? null,
    city: address.city ?? null,
    region: address.region ?? null,
    country: address.country ?? null,
    addressType,
    addressReferenceId: null,
  };
}

function quoteBuyers(
  customer: Quote['customer'],
  companyId: string | null,
): CompanyBuyer[] | null {
  if (!customer?.id || !(customer.firstName || customer.lastName)) return null;
  return [
    {
      id: customer.id,
      internalId: null,
      firstName: customer.firstName ?? null,
      lastName: customer.lastName ?? null,
      phone: null,
      companyId,
      active: true,
      restrictToDedicatedPriceLists: false,
    },
  ];
}

/**
 * The quotation's company in the checkout cards' shape: its billing address,
 * its shipping address as the delivery address, and its customer as the
 * buyer, whom the card matches on the signed-in email.
 */
export function quoteCheckoutCompany(quote: Quote): Company | null {
  if (!quote.company) return null;
  const companyId = quote.company.companyId ?? null;
  const addresses: CompanyAddress[] = [];
  if (quote.billingAddress) {
    addresses.push(companyAddress(quote.billingAddress, 'billing', companyId));
  }
  if (quote.shippingAddress) {
    addresses.push(
      companyAddress(quote.shippingAddress, 'delivery', companyId),
    );
  }
  return {
    id: companyId ?? '',
    name: quote.company.name ?? null,
    vatNumber: quote.company.vatNumber ?? null,
    exVat: false,
    limitedProductAccess: false,
    addresses,
    buyers: quoteBuyers(quote.customer, companyId),
  };
}

/**
 * The quotation's payment methods as checkout options. Numbered by position:
 * the order takes its method from the quotation, so the id only marks the
 * radio. No fee: the API does not say on which side of VAT it is. The display
 * name when Geins gives one, never the technical name ("ManualInvoice"):
 * without one the option shows the checkout's own invoice label.
 */
export function quotePaymentOptions(quote: Quote): PaymentOptionType[] {
  return (quote.paymentMethods ?? []).map((method, index) => ({
    id: index + 1,
    displayName: method.displayName,
    feeIncVat: 0,
    feeExVat: 0,
    isDefault: false,
    isSelected: false,
  }));
}
