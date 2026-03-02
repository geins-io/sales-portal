import { describe, it, expect } from 'vitest';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../../../server/schemas/api-input';

describe('ForgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = ForgotPasswordSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = ForgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts valid resetKey and password', () => {
    const result = ResetPasswordSchema.safeParse({
      resetKey: 'abc123',
      password: 'newpass88',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing resetKey', () => {
    const result = ResetPasswordSchema.safeParse({ password: 'newpass88' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = ResetPasswordSchema.safeParse({
      resetKey: 'abc123',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = ResetPasswordSchema.safeParse({
      resetKey: 'abc123',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
