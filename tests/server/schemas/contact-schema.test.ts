import { describe, it, expect } from 'vitest';
import {
  ContactFormSchema,
  type ContactFormInput,
} from '../../../server/schemas/api-input';

describe('ContactFormSchema', () => {
  const validPayload: ContactFormInput = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+46701234567',
    subject: 'General inquiry',
    message: 'I would like to know more about your products.',
  };

  it('accepts a valid full payload', () => {
    const result = ContactFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validPayload);
  });

  it('accepts payload without optional phone', () => {
    const { phone: _, ...withoutPhone } = validPayload;
    const result = ContactFormSchema.safeParse(withoutPhone);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(withoutPhone);
  });

  it('rejects missing name', () => {
    const { name: _, ...payload } = validPayload;
    const result = ContactFormSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = ContactFormSchema.safeParse({ ...validPayload, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const { email: _, ...payload } = validPayload;
    const result = ContactFormSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing subject', () => {
    const { subject: _, ...payload } = validPayload;
    const result = ContactFormSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty subject', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      subject: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing message', () => {
    const { message: _, ...payload } = validPayload;
    const result = ContactFormSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty message', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      message: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 100 characters', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('accepts name at exactly 100 characters', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      name: 'a'.repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it('rejects subject exceeding 200 characters', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      subject: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects message exceeding 5000 characters', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      message: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts message at exactly 5000 characters', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      message: 'a'.repeat(5000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects phone exceeding 50 characters', () => {
    const result = ContactFormSchema.safeParse({
      ...validPayload,
      phone: '1'.repeat(51),
    });
    expect(result.success).toBe(false);
  });
});
