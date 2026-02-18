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
