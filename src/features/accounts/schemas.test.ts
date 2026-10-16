import { expect, it } from 'vitest';
import { createAccountSchema, issuedPasswordSchema, profilePatch, profileSchema } from './schemas';

const profile = { firstName: 'Jordan', lastName: 'Employee', role: 'staff' as const };
it('normalizes names and email without trimming an issued password', () => {
  const password = '  long issued password  ';
  const result = createAccountSchema.parse({
    ...profile,
    firstName: ' Jordan ',
    email: ' USER@Example.test ',
    password,
    confirmPassword: password,
  });
  expect(result).toMatchObject({ firstName: 'Jordan', email: 'user@example.test', password });
});
it('rejects invalid names, unknown fields, password limits, NUL and mismatched confirmation', () => {
  for (const firstName of ['', ' ', 'x'.repeat(101), 'a\0b'])
    expect(profileSchema.safeParse({ ...profile, firstName }).success).toBe(false);
  expect(profileSchema.safeParse({ ...profile, email: 'changed@example.test' }).success).toBe(
    false,
  );
  for (const password of ['short', 'x'.repeat(129), 'long password\0'])
    expect(issuedPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(
      false,
    );
  expect(
    issuedPasswordSchema.safeParse({
      password: 'valid long password',
      confirmPassword: 'different password',
    }).success,
  ).toBe(false);
});
it('patches only changed fields so name edits do not resend stale roles or email', () => {
  expect(profilePatch(profile, { ...profile, firstName: ' Avery ' })).toEqual({
    firstName: 'Avery',
  });
  expect(profilePatch(profile, { ...profile, firstName: ' Jordan ' })).toEqual({});
  expect(profilePatch(profile, { ...profile, role: 'admin' })).toEqual({ role: 'admin' });
});
