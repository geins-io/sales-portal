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
    email: 'jane@acme.com',
    phone: '+46701234567',
    message: 'We are interested in a wholesale account.',
  };

  it('accepts a valid full payload', () => {
    const result = ApplyForAccountSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validPayload);
  });

  it('accepts without optional phone', () => {
    const { phone: _, ...withoutPhone } = validPayload;
    const result = ApplyForAccountSchema.safeParse(withoutPhone);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(withoutPhone);
  });

  it('accepts without optional message', () => {
    const { message: _, ...withoutMessage } = validPayload;
    const result = ApplyForAccountSchema.safeParse(withoutMessage);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(withoutMessage);
  });

  it('accepts without both optional fields', () => {
    const { phone: _p, message: _m, ...minimal } = validPayload;
    const result = ApplyForAccountSchema.safeParse(minimal);
    expect(result.success).toBe(true);
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

  it('rejects message exceeding 5000 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      message: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts message at exactly 5000 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      message: 'a'.repeat(5000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects phone exceeding 50 characters', () => {
    const result = ApplyForAccountSchema.safeParse({
      ...validPayload,
      phone: '1'.repeat(51),
    });
    expect(result.success).toBe(false);
  });
});
