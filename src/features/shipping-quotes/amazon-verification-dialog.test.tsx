import { type ApiClient, ApiError } from '@api/api';
import { NotificationProvider } from '@components/feedback/notification-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AmazonVerificationDialog } from './amazon-verification-dialog';

const id = '11111111-1111-4111-8111-111111111111';
const frame = '22222222-2222-4222-8222-222222222222';
const base = { id, expiresAt: '2099-10-22T00:00:00.000Z' };
const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
function setup(request: ReturnType<typeof vi.fn>, onVerified = vi.fn(async () => {})) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(queries);
  const close = vi.fn();
  const view = render(
    <QueryClientProvider client={queries}>
      <NotificationProvider>
        <AmazonVerificationDialog
          client={{ request } as unknown as ApiClient}
          comparisonId={id}
          attemptId={frame}
          onClose={close}
          onVerified={onVerified}
        />
      </NotificationProvider>
    </QueryClientProvider>,
  );
  return { ...view, onVerified, close, queries };
}

it('opens a challenge, maps the staff click, retries once after verification, and cancels on close', async () => {
  const request = vi.fn(async (config: { data: { operation: string } }) => {
    if (config.data.operation === 'action') return { ...base, state: 'verified' };
    if (config.data.operation === 'cancel') return { ...base, state: 'cancelled' };
    return { ...base, state: 'challenge', image: 'fixture', frame, width: 400, height: 200 };
  });
  const { onVerified, unmount } = setup(request);
  const challenge = await screen.findByRole('button', { name: 'Amazon verification challenge' });
  await waitFor(() => expect(challenge).toBeEnabled());
  vi.spyOn(challenge, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    top: 20,
    width: 400,
    height: 200,
  } as DOMRect);
  fireEvent.click(challenge, { clientX: 110, clientY: 120 });
  await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { operation: 'action', id, action: { type: 'click', frame, x: 0.25, y: 0.5 } },
    }),
  );
  await act(async () => {});
  expect(onVerified).toHaveBeenCalledTimes(1);
  unmount();
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ data: { operation: 'cancel', id } }),
  );
});

it('shows an unavailable/busy error without exposing a stale challenge or retrying rates', async () => {
  const request = vi
    .fn()
    .mockRejectedValue(new ApiError(409, 'Another staff verification is in progress.'));
  const { onVerified } = setup(request);
  expect(await screen.findByText('Another staff verification is in progress.')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Amazon verification challenge' }),
  ).not.toBeInTheDocument();
  expect(onVerified).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

it('hides challenge pixels after an action fails and provides error feedback', async () => {
  const request = vi.fn(async (config: { data: { operation: string } }) => {
    if (config.data.operation === 'action')
      throw new ApiError(401, 'Your session has ended. Sign in again.');
    return { ...base, state: 'challenge', image: 'fixture', frame, width: 400, height: 200 };
  });
  const { onVerified } = setup(request);
  await screen.findByRole('button', { name: 'Amazon verification challenge' });
  await userEvent.type(screen.getByLabelText('Challenge answer or verification code'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Amazon verification challenge' }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getAllByText('Your session has ended. Sign in again.').length).toBeGreaterThan(0);
  expect(onVerified).not.toHaveBeenCalled();
});

it('reports retry failure without automatically retrying the quote again', async () => {
  const request = vi.fn().mockResolvedValue({ ...base, state: 'verified' });
  const onVerified = vi.fn().mockRejectedValue(new ApiError(409, 'Ship date has passed.'));
  setup(request, onVerified);
  expect(await screen.findByText(/Amazon is verified, but retry did not complete/)).toBeVisible();
  expect(onVerified).toHaveBeenCalledTimes(1);
});
