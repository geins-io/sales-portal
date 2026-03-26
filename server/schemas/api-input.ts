import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const RegisterSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  user: z.record(z.string(), z.unknown()).optional(),
});

export const PreviewSchema = z.object({
  loginToken: z.string().min(1),
});

export const NewsletterSubscribeSchema = z.object({
  email: z.email(),
});

const ClientErrorSchema = z.object({
  message: z.string().min(1),
  name: z.string().min(1),
  stack: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
  url: z.string(),
  userAgent: z.string(),
});

export const ErrorBatchSchema = z.object({
  errors: z.array(ClientErrorSchema).nonempty(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type PreviewInput = z.infer<typeof PreviewSchema>;
export type NewsletterSubscribeInput = z.infer<
  typeof NewsletterSubscribeSchema
>;
export type ErrorBatchInput = z.infer<typeof ErrorBatchSchema>;

export const CmsPageSchema = z.object({
  alias: z.string().min(1).max(200),
});

export const CmsAreaSchema = z.object({
  family: z.string().min(1).max(100),
  areaName: z.string().min(1).max(100),
});

export type CmsPageInput = z.infer<typeof CmsPageSchema>;
export type CmsAreaInput = z.infer<typeof CmsAreaSchema>;

export const CmsMenuSchema = z.object({
  menuLocationId: z.string().min(1).max(100),
  locale: z.string().min(2).max(10).optional(),
});

export type CmsMenuInput = z.infer<typeof CmsMenuSchema>;

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const ProductAliasSchema = z.object({
  alias: z.string().min(1).max(200),
});
export type ProductAliasInput = z.infer<typeof ProductAliasSchema>;

export const ProductReviewsSchema = z.object({
  alias: z.string().min(1).max(200),
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(50).optional(),
});
export type ProductReviewsInput = z.infer<typeof ProductReviewsSchema>;

export const PostReviewSchema = z.object({
  alias: z.string().min(1).max(200),
  rating: z.number().min(1).max(5),
  author: z.string().min(1).max(100),
  comment: z.string().max(2000).optional(),
});
export type PostReviewInput = z.infer<typeof PostReviewSchema>;

export const MonitorAvailabilitySchema = z.object({
  email: z.string().email(),
  skuId: z.number(),
});
export type MonitorAvailabilityInput = z.infer<
  typeof MonitorAvailabilitySchema
>;

// ---------------------------------------------------------------------------
// Product Lists
// ---------------------------------------------------------------------------
const jsonFilter = z
  .union([
    z.record(z.string(), z.unknown()),
    z
      .string()
      .transform((s) => JSON.parse(s) as Record<string, unknown>)
      .pipe(z.record(z.string(), z.unknown())),
  ])
  .optional();

export const ProductListSchema = z.object({
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(100).optional(),
  categoryAlias: z.string().max(200).optional(),
  brandAlias: z.string().max(200).optional(),
  discountCampaignAlias: z.string().max(200).optional(),
  filter: jsonFilter,
});
export type ProductListInput = z.infer<typeof ProductListSchema>;

export const ListPageSchema = z.object({
  alias: z.string().min(1).max(200),
});
export type ListPageInput = z.infer<typeof ListPageSchema>;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export const SearchProductsSchema = z.object({
  query: z.string().min(1).max(200),
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(50).optional(),
  filter: jsonFilter,
});
export type SearchProductsInput = z.infer<typeof SearchProductsSchema>;

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------
export const CartIdSchema = z.object({
  cartId: z.string().min(1),
});
export type CartIdInput = z.infer<typeof CartIdSchema>;

export const CartGetSchema = z.object({
  cartId: z.string().min(1).optional(),
});
export type CartGetInput = z.infer<typeof CartGetSchema>;

export const CartAddItemSchema = z.object({
  cartId: z.string().min(1),
  skuId: z.number(),
  quantity: z.number().min(1).max(999),
});
export type CartAddItemInput = z.infer<typeof CartAddItemSchema>;

export const CartUpdateItemSchema = z.object({
  cartId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.number().min(0).max(999),
});
export type CartUpdateItemInput = z.infer<typeof CartUpdateItemSchema>;

export const CartDeleteItemSchema = z.object({
  cartId: z.string().min(1),
  itemId: z.string().min(1),
});
export type CartDeleteItemInput = z.infer<typeof CartDeleteItemSchema>;

export const CartPromoCodeSchema = z.object({
  cartId: z.string().min(1),
  promoCode: z.string().min(1).max(50),
});
export type CartPromoCodeInput = z.infer<typeof CartPromoCodeSchema>;

// ---------------------------------------------------------------------------
// Auth — Password Reset
// ---------------------------------------------------------------------------
export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  resetKey: z.string().min(1),
  password: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------
export const UpdateProfileSchema = z.object({
  address: z
    .object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      company: z.string().max(200).optional(),
      phone: z.string().max(50).optional(),
      mobile: z.string().max(50).optional(),
      addressLine1: z.string().max(200).optional(),
      addressLine2: z.string().max(200).optional(),
      zip: z.string().max(20).optional(),
      city: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
    })
    .optional(),
  newsletter: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ---------------------------------------------------------------------------
// B2B Organization
// ---------------------------------------------------------------------------
export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  organizationNumber: z.string().max(50).optional(),
  referenceContact: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

const ShippingAddressSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  addressLine3: z.string().max(200).optional(),
  postalCode: z.string().min(1).max(20),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
});

export const AddAddressSchema = z.object({
  label: z.string().min(1).max(200),
  isDefault: z.boolean().optional(),
  address: ShippingAddressSchema,
});
export type AddAddressInput = z.infer<typeof AddAddressSchema>;

export const UpdateAddressSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  address: ShippingAddressSchema.partial().optional(),
});
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;

const BuyerRoleEnum = z.enum(['org_admin', 'order_approver', 'order_placer']);

export const InviteBuyerSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: BuyerRoleEnum,
});
export type InviteBuyerInput = z.infer<typeof InviteBuyerSchema>;

export const UpdateBuyerRoleSchema = z.object({
  role: BuyerRoleEnum,
});
export type UpdateBuyerRoleInput = z.infer<typeof UpdateBuyerRoleSchema>;

// ---------------------------------------------------------------------------
// Apply for Account (B2B)
// ---------------------------------------------------------------------------
export const ApplyForAccountSchema = z.object({
  companyName: z.string().min(1).max(200),
  organizationNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  message: z.string().max(5000).optional(),
});
export type ApplyForAccountInput = z.infer<typeof ApplyForAccountSchema>;

// ---------------------------------------------------------------------------
// Contact Form
// ---------------------------------------------------------------------------
export const ContactFormSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});
export type ContactFormInput = z.infer<typeof ContactFormSchema>;

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
export const CheckoutAddressSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  addressLine3: z.string().max(200).optional(),
  entryCode: z.string().max(50).optional(),
  careOf: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(1).max(100),
  zip: z.string().min(1).max(20),
  company: z.string().max(200).optional(),
  mobile: z.string().max(50).optional(),
  phone: z.string().max(50).optional(),
});
export type CheckoutAddressInput = z.infer<typeof CheckoutAddressSchema>;

export const GetCheckoutSchema = z.object({
  cartId: z.string().min(1),
});
export type GetCheckoutInput = z.infer<typeof GetCheckoutSchema>;

export const PlaceOrderSchema = z.object({
  cartId: z.string().min(1),
  paymentId: z.number(),
  shippingId: z.number(),
  email: z.string().email(),
  identityNumber: z.string().max(50).optional(),
  message: z.string().max(2000).optional(),
  acceptedConsents: z.array(z.string()).optional(),
  billingAddress: CheckoutAddressSchema,
  shippingAddress: CheckoutAddressSchema.optional(),
  customerType: z.string().max(50).optional(),
});
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

export const ValidateOrderSchema = z.object({
  cartId: z.string().min(1),
  email: z.string().email().optional(),
});
export type ValidateOrderInput = z.infer<typeof ValidateOrderSchema>;

export const CheckoutSummarySchema = z.object({
  orderId: z.string().min(1),
  paymentMethod: z.string().min(1),
});
export type CheckoutSummaryInput = z.infer<typeof CheckoutSummarySchema>;

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------
export const CreateQuoteSchema = z.object({
  cartId: z.string().min(1),
  message: z.string().max(2000).optional(),
  poNumber: z.string().max(100).optional(),
  paymentTerms: z.string().max(200).optional(),
});
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;

export const AcceptQuoteSchema = z.object({
  quoteId: z.string().min(1),
});
export type AcceptQuoteInput = z.infer<typeof AcceptQuoteSchema>;

export const RejectQuoteSchema = z.object({
  quoteId: z.string().min(1),
  reason: z.string().max(2000).optional(),
});
export type RejectQuoteInput = z.infer<typeof RejectQuoteSchema>;

export const ListQuotesSchema = z.object({
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(50).optional(),
});
export type ListQuotesInput = z.infer<typeof ListQuotesSchema>;
