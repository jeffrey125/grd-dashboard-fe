import { type ApiClient, ApiError } from '@api/api';
import { accountSchema } from '@features/auth';
import { z } from 'zod';
import {
  type CreateAccountInput,
  createAccountSchema,
  issuedPasswordSchema,
  type ProfileInput,
  profileSchema,
} from './schemas';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(502, 'The server returned an invalid account response. Try again.');
  return result.data;
}
export class AccountConflict extends ApiError {
  constructor(
    readonly field: 'email' | 'access',
    message: string,
  ) {
    super(409, message);
  }
}
export function accountError(status: number, body: unknown) {
  if (status !== 409 || !body || typeof body !== 'object' || !('message' in body)) return;
  // Match known server messages, never render arbitrary server diagnostics or submitted values.
  if (body.message === 'Email already exists')
    return new AccountConflict('email', 'An account already uses this email address.');
  if (body.message === 'Cannot remove your own administrator access')
    return new AccountConflict('access', 'You cannot deactivate or demote your own Admin account.');
  if (body.message === 'At least one active administrator is required')
    return new AccountConflict(
      'access',
      'At least one active Admin must remain. This change was not saved.',
    );
}
export async function listAccounts(client: ApiClient, signal: AbortSignal) {
  return parse(z.array(accountSchema), await client.request({ url: '/admin/accounts', signal }));
}
export async function getAccount(client: ApiClient, id: string, signal: AbortSignal) {
  const account = parse(
    accountSchema,
    await client.request({ url: `/admin/accounts/${id}`, signal }),
  );
  if (account.externalId !== id)
    throw new ApiError(502, 'The server returned a different account. Try again.');
  return account;
}
export async function createAccount(client: ApiClient, input: CreateAccountInput) {
  const { confirmPassword: _confirmation, ...data } = createAccountSchema.parse(input);
  return parse(
    accountSchema,
    await client.request({ url: '/admin/accounts', method: 'POST', data, mapError: accountError }),
  );
}
export async function updateAccount(
  client: ApiClient,
  id: string,
  input: Partial<ProfileInput> | { active: boolean },
) {
  const data = profileSchema
    .partial()
    .extend({ active: z.boolean().optional() })
    .strict()
    .refine((value) => Object.keys(value).length > 0)
    .parse(input);
  return parse(
    accountSchema,
    await client.request({
      url: `/admin/accounts/${id}`,
      method: 'PATCH',
      data,
      mapError: accountError,
    }),
  );
}
export async function resetAccountPassword(
  client: ApiClient,
  id: string,
  input: { password: string; confirmPassword: string },
) {
  const { password } = issuedPasswordSchema.parse(input);
  await client.request({
    url: `/admin/accounts/${id}/password`,
    method: 'POST',
    data: { password },
    mapError: accountError,
  });
}
