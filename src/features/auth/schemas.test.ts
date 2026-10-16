import { expect, it } from 'vitest';
import { changePasswordSchema, safeReturnTo, signInSchema } from './schemas';

it('normalizes email but preserves a legacy sign-in password exactly', () => {
  expect(signInSchema.parse({ email: ' Staff@Example.test ', password: ' x ' })).toEqual({
    email: 'staff@example.test',
    password: ' x ',
  });
  expect(signInSchema.safeParse({ email: 'staff@example.test', password: '' }).success).toBe(false);
});

it('enforces replacement length, NUL rejection and confirmation without trimming', () => {
  const input = {
    currentPassword: 'x',
    newPassword: ' 1234567890 ',
    confirmPassword: ' 1234567890 ',
  };
  expect(changePasswordSchema.parse(input).newPassword).toBe(input.newPassword);
  for (const newPassword of ['short', 'x'.repeat(129), `123456789012\0`]) {
    expect(
      changePasswordSchema.safeParse({ ...input, newPassword, confirmPassword: newPassword })
        .success,
    ).toBe(false);
  }
  expect(changePasswordSchema.safeParse({ ...input, confirmPassword: 'different' }).success).toBe(
    false,
  );
});

it('preserves internal paths and rejects external, malformed and auth-loop returns', () => {
  expect(safeReturnTo('/shipments?tab=paused&page=2#record')).toBe(
    '/shipments?tab=paused&page=2#record',
  );
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2fevil.test',
    '/%5cevil.test',
    '/login?returnTo=/',
    '/change-password',
    '/x/../login',
    '/%0aevil',
    '/%zz',
    undefined,
  ]) {
    expect(safeReturnTo(path)).toBe('/');
  }
});
