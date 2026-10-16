import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(100, 'Use at most 100 characters.')
  .refine((value) => !value.includes('\0'), 'This character is not supported.');
export const profileSchema = z
  .object({
    firstName: name,
    lastName: name,
    role: z.enum(['staff', 'admin']),
  })
  .strict();
const password = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((value) => !value.includes('\0'), 'This character is not supported.');
const passwordFields = { password, confirmPassword: z.string() };
const matchingPasswords = (value: { password: string; confirmPassword: string }) =>
  value.password === value.confirmPassword;
const confirmationError = { path: ['confirmPassword'], message: 'The passwords do not match.' };
export const issuedPasswordSchema = z
  .object(passwordFields)
  .strict()
  .refine(matchingPasswords, confirmationError);
export const createAccountSchema = profileSchema
  .extend({
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254)),
    ...passwordFields,
  })
  .refine(matchingPasswords, confirmationError);
export type ProfileInput = z.infer<typeof profileSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type IssuedPasswordInput = z.infer<typeof issuedPasswordSchema>;

/** Only fields changed by this edit are sent; email is never part of an edit. */
export function profilePatch(baseline: ProfileInput, next: ProfileInput) {
  const parsed = profileSchema.parse(next);
  const patch: Partial<ProfileInput> = {};
  if (parsed.firstName !== baseline.firstName) patch.firstName = parsed.firstName;
  if (parsed.lastName !== baseline.lastName) patch.lastName = parsed.lastName;
  if (parsed.role !== baseline.role) patch.role = parsed.role;
  return patch;
}
