import type { Account } from '@features/auth/schemas';

export const accountFixture: Account = {
  externalId: '11111111-1111-4111-8111-111111111111',
  firstName: 'Jordan',
  lastName: 'Staff',
  email: 'staff@example.test',
  role: 'staff',
  active: true,
  mustChangePassword: false,
  createdAt: '2026-10-16T00:00:00.000Z',
  updatedAt: '2026-10-16T00:00:00.000Z',
};
