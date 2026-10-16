import { ApiClient, ApiError } from '@api/api';
import { accountFixture } from '@test/auth-fixture';
import { expect, it, vi } from 'vitest';
import {
  accountError,
  createAccount,
  getAccount,
  resetAccountPassword,
  updateAccount,
} from './api';

it('sends only supported account fields and does not cache/return password responses', async () => {
  const client = new ApiClient('http://localhost:3000');
  const request = vi.spyOn(client, 'request').mockResolvedValue(accountFixture);
  const input = {
    firstName: ' Jordan ',
    lastName: 'Staff',
    email: ' STAFF@example.test ',
    role: 'staff' as const,
    password: 'issued test password',
    confirmPassword: 'issued test password',
  };
  const result = await createAccount(client, input);
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      url: '/admin/accounts',
      data: {
        firstName: 'Jordan',
        lastName: 'Staff',
        email: 'staff@example.test',
        role: 'staff',
        password: input.password,
      },
    }),
  );
  expect(result).not.toHaveProperty('password');
  request.mockResolvedValueOnce(undefined);
  expect(
    await resetAccountPassword(client, accountFixture.externalId, {
      password: input.password,
      confirmPassword: input.confirmPassword,
    }),
  ).toBeUndefined();
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ data: { password: input.password } }),
  );
  await expect(updateAccount(client, accountFixture.externalId, {})).rejects.toThrow();
});
it('allowlists conflicts and never exposes arbitrary server messages', () => {
  expect(accountError(409, { message: 'Email already exists' })?.message).toContain('already uses');
  expect(
    accountError(409, { message: 'At least one active administrator is required' })?.message,
  ).toContain('active Admin');
  expect(
    accountError(409, { message: 'Cannot remove your own administrator access' })?.message,
  ).toContain('own Admin');
  expect(accountError(409, { message: 'SQL private diagnostic' })).toBeUndefined();
  expect(accountError(500, { message: 'Email already exists' })).toBeUndefined();
});
it('rejects malformed and mismatched detail responses without leaking their values', async () => {
  const client = new ApiClient('http://localhost:3000');
  vi.spyOn(client, 'request')
    .mockResolvedValueOnce({ password: 'private' })
    .mockResolvedValueOnce(accountFixture);
  await expect(
    getAccount(client, accountFixture.externalId, new AbortController().signal),
  ).rejects.toBeInstanceOf(ApiError);
  await expect(
    getAccount(client, '22222222-2222-4222-8222-222222222222', new AbortController().signal),
  ).rejects.toThrow('different account');
});
