import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { shipmentFixture } from '@test/shipment-fixture';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AssignmentSection } from './assignment-section';

vi.mock('@features/auth', () => ({ useSession: () => ({ session: { client: {} } }) }));
vi.mock('@components/feedback/notification-provider', () => ({
  useNotifications: () => ({ showNotification: vi.fn() }),
}));

it('enables Save changes after changing only the manual carrier status', async () => {
  const user = userEvent.setup();
  const base = shipmentFixture();
  const shipment = shipmentFixture(1, {
    carrier: { ...base.carrier, code: 'other', name: 'Other' },
    currentTracking: {
      externalId: '90000000-0000-4000-8000-000000000001',
      carrierStatus: 'Pending Pickup',
      carrierStatusDetail: null,
      pickedUpOn: null,
      estimatedDeliveryOn: null,
      deliveredOn: null,
      observedAt: '2026-10-28T00:00:00Z',
    },
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AssignmentSection
        shipment={shipment}
        salesReps={[]}
        disabled={false}
        onMissing={vi.fn()}
        onDirty={vi.fn()}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Carrier Status'), 'Delivered');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});
