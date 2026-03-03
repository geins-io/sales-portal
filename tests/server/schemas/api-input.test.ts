import { describe, it, expect } from 'vitest';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
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

describe('UpdateProfileSchema', () => {
  it('accepts valid address fields', () => {
    const result = UpdateProfileSchema.safeParse({
      address: { firstName: 'John', lastName: 'Doe', city: 'Stockholm' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no changes)', () => {
    const result = UpdateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts newsletter boolean', () => {
    const result = UpdateProfileSchema.safeParse({ newsletter: true });
    expect(result.success).toBe(true);
  });

  it('rejects firstName longer than 100 chars', () => {
    const result = UpdateProfileSchema.safeParse({
      address: { firstName: 'a'.repeat(101) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string address fields', () => {
    const result = UpdateProfileSchema.safeParse({
      address: { firstName: 123 },
    });
    expect(result.success).toBe(false);
  });
});

describe('ChangePasswordSchema', () => {
  it('accepts valid passwords', () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty currentPassword', () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'newpass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects newPassword shorter than 8 chars', () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = ChangePasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
