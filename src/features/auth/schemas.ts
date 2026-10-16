import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const currentPassword = z.string().min(1, 'Enter your password.').max(128);
const newPassword = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128)
  .refine((value) => !value.includes('\0'), 'This character is not supported.');

export const signInSchema = z.object({ email, password: currentPassword }).strict();
export const changePasswordSchema = z
  .object({
    currentPassword,
    newPassword,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match.',
  });

export const accountSchema = z.object({
  externalId: z.uuidv4(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(['admin', 'staff']),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Account = z.infer<typeof accountSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type PasswordInput = z.infer<typeof changePasswordSchema>;

/** Resolve once, reject encoded/backslash redirects, and keep internal search/hash. */
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    [...value].some((character) => character === '\\' || character.charCodeAt(0) <= 32)
  )
    return '/';
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith('//') ||
      [...decoded].some((character) => character === '\\' || character.charCodeAt(0) <= 32)
    )
      return '/';
    const url = new URL(value, 'https://dashboard.invalid');
    if (
      url.origin !== 'https://dashboard.invalid' ||
      /^\/(login|change-password)(\/|$)/.test(decodeURIComponent(url.pathname))
    )
      return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
