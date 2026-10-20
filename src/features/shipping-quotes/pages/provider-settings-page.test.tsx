import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ProviderSettingsPage } from './provider-settings-page';

const mocks = vi.hoisted(() => ({
  role: 'admin',
  settings: vi.fn(),
  test: vi.fn(),
  result: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@features/auth', () => ({
  useSession: () => ({
    session: { client: {} },
    account: { role: mocks.role },
    status: 'authenticated',
  }),
}));
vi.mock('@features/shipping-quotes/api', () => ({
  getProviderSettings: mocks.settings,
  getProviders: async () => [],
  refreshSender: mocks.refresh,
  testProviderReadiness: mocks.test,
  getProviderReadiness: mocks.result,
  saveProviderSettings: mocks.save,
}));
const provider = {
  code: 'amazon',
  name: 'Amazon Shipping',
  enabled: true,
  executionMode: 'request',
  maintenanceMessage: null,
  staleHours: 1,
  revision: 0,
  updatedAt: '2026-10-20T10:00:00Z',
  updatedBy: null,
  savedConnectionTest: null,
};
const failure = {
  id: '11111111-1111-4111-8111-111111111111',
  executionMode: 'browser',
  state: 'failed',
  failureSummary: 'readiness_failed',
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  testedBy: '11111111-1111-4111-8111-111111111112',
  savedAt: null,
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProviderSettingsPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = 'admin';
  mocks.settings.mockResolvedValue([provider]);
  mocks.test.mockResolvedValue(failure);
  mocks.result.mockResolvedValue(failure);
  mocks.save.mockResolvedValue([
    { ...provider, executionMode: 'browser', revision: 1, savedConnectionTest: failure },
  ]);
});

it('shows the one-hour initial policy and requires explicit failed-test acknowledgment', async () => {
  const user = userEvent.setup();
  mount();
  expect(await screen.findByLabelText('Stale period (hours)')).toHaveValue(1);
  await user.click(screen.getByRole('combobox', { name: 'Execution mode' }));
  await user.click(screen.getByRole('option', { name: 'Browser' }));
  expect(screen.getByRole('button', { name: 'Save Amazon Shipping settings' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Test browser readiness' }));
  expect(await screen.findByText(/Connection test failed/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Amazon Shipping settings' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: /I acknowledge/ }));
  await user.click(screen.getByRole('button', { name: 'Save Amazon Shipping settings' }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      {},
      'amazon',
      expect.objectContaining({
        executionMode: 'browser',
        connectionTestId: failure.id,
        acknowledgeFailure: true,
        staleHours: 1,
      }),
    ),
  );
  expect(
    await screen.findByText(/This configuration was saved after a failed/),
  ).toBeInTheDocument();
});

it('does not fetch settings or show editing controls to staff', () => {
  mocks.role = 'staff';
  mount();
  expect(screen.getByText('Administrator access required.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
  expect(mocks.settings).not.toHaveBeenCalled();
});

it('requires a new test when a result has expired', async () => {
  const user = userEvent.setup();
  const expired = {
    ...failure,
    state: 'succeeded',
    failureSummary: null,
    expiresAt: '2020-01-01T00:00:00Z',
  };
  mocks.test.mockResolvedValue(expired);
  mocks.result.mockResolvedValue(expired);
  mount();
  await screen.findByLabelText('Stale period (hours)');
  await user.click(screen.getByRole('combobox', { name: 'Execution mode' }));
  await user.click(screen.getByRole('option', { name: 'Browser' }));
  await user.click(screen.getByRole('button', { name: 'Test browser readiness' }));
  expect(await screen.findByText(/Connection test expired/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Amazon Shipping settings' })).toBeDisabled();
});

it('refreshes and displays account-default details on the settings surface', async () => {
  const user = userEvent.setup();
  mocks.refresh.mockResolvedValue({
    refreshId: crypto.randomUUID(),
    address: {
      name: 'Admin warehouse',
      street: '1 Example St',
      city: 'Walworth',
      division: 'WI',
      postalCode: '53125',
      country: 'US',
    },
    retrievedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  });
  mount();
  await user.click(await screen.findByRole('button', { name: 'Refresh Amazon Shipping default' }));
  expect(await screen.findByText(/Admin warehouse.*Retrieved/)).toBeInTheDocument();
  expect(mocks.refresh).toHaveBeenCalledWith({}, 'amazon');
});
