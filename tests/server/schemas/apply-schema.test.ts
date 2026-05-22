import { describe, it, expect } from 'vitest';
import {
  ApplyForAccountSchema,
  type ApplyForAccountInput,
} from '../../../server/schemas/api-input';

describe('ApplyForAccountSchema', () => {
  const validPayload: ApplyForAccountInput = {
    companyName: 'Acme Corp',
    organizationNumber: '556677-8899',
    firstName: 'Jane',
    lastName: 'Doe',
    country: 'SE',
    email: 'jane@acme.com',
    acceptTerms: true,
  };

  it('accepts a valid payload', () => {
    const result = ApplyForAccountSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validPayload);
  });

  it('rejects missing companyName', () => {
    const { companyName: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty companyName', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      companyName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing organizationNumber', () => {
    const { organizationNumber: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty organizationNumber', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      organizationNumber: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing firstName', () => {
    const { firstName: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      firstName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing lastName', () => {
    const { lastName: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty lastName', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      lastName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const { email: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects companyName exceeding 200 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      companyName: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts companyName at exactly 200 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      companyName: 'a'.repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it('rejects organizationNumber exceeding 50 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      organizationNumber: 'a'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects firstName exceeding 100 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      firstName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects lastName exceeding 100 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      lastName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  // --- New fields: country, acceptTerms ---

  it('rejects missing country', () => {
    const { country: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid country code', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      country: 'US',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid country codes', () => {
    for (const code of ['SE', 'NO', 'DK', 'FI', 'DE', 'GB'] as const) {
      const result = ApplyForAccountSchema.safeParse({
        ...validPayload,
        country: code,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing acceptTerms', () => {
    const { acceptTerms: _, ...payload } = validPayload;
    const result = ApplyForAccountSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects acceptTerms = false', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts acceptTerms = true', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      acceptTerms: true,
    });
    expect(result.success).toBe(true);
  });
});
