import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
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
export const ProductListSchema = z.object({
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(100).optional(),
  categoryAlias: z.string().max(200).optional(),
  brandAlias: z.string().max(200).optional(),
  discountCampaignAlias: z.string().max(200).optional(),
  filter: z.record(z.string(), z.unknown()).optional(),
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
  filter: z.record(z.string(), z.unknown()).optional(),
});
export type SearchProductsInput = z.infer<typeof SearchProductsSchema>;

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------
export const CartIdSchema = z.object({
  cartId: z.string().min(1),
});
export type CartIdInput = z.infer<typeof CartIdSchema>;

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
