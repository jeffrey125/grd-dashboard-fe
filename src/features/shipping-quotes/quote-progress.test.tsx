import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuoteProgress } from './quote-progress';
import type { Comparison } from './schemas';

const attempt = (
  status: Comparison['status'],
  provider: 'amazon' | 'unishippers' = 'amazon',
): Comparison['attempts'][number] => ({
  externalId: crypto.randomUUID(),
  provider,
  status,
  attemptNumber: 1,
  executionMode: provider === 'amazon' ? 'api' : 'request',
  startedAt: null,
  completedAt: null,
  recoveryCount: 0,
  outcome: null,
  reasonCode: null,
  simulated: false,
  quotes: [],
});
const comparison = (
  status: Comparison['status'],
  attempts: Comparison['attempts'],
): Comparison => ({
  externalId: crypto.randomUUID(),
  createdAt: '2026-10-19T12:00:00.000Z',
  createdBy: crypto.randomUUID(),
  status,
  ratesRun: true,
  input: {} as Comparison['input'],
  senders: [],
  warnings: [],
  attempts,
});

describe('Quote progress', () => {
  it('offers Retry only for an eligible attempt and displays its chronology and origin', async () => {
    const onRetry = vi.fn();
    const failed = {
      ...attempt('failed'),
      retryBlockedReason: null,
      createdAt: '2026-10-19T12:00:00.000Z',
      sender: {
        code: 'amazon' as const,
        mode: 'explicit' as const,
        retrievedAt: null,
        address: {
          name: 'Original warehouse',
          street: '1 Example St',
          city: 'Walworth',
          division: 'WI',
          postalCode: '53125',
          country: 'US',
        },
      },
    };
    const value = comparison('failed', [failed]);
    const { rerender } = render(<QuoteProgress comparison={value} onRetry={onRetry} />);
    expect(screen.getByText(/Attempt 1 · Mode: api/)).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Technical details' }));
    expect(screen.getByText(/Attempt 1 · Mode: api/)).toBeVisible();
    expect(screen.getByText(/Actual provider origin: Original warehouse/)).toBeInTheDocument();
    expect(screen.getByText(/Queued: Oct 19, 2026, 8:00 AM ET/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry Amazon Shipping' }));
    expect(onRetry).toHaveBeenCalledWith(failed.externalId);
    rerender(<QuoteProgress comparison={value} onRetry={onRetry} pending />);
    expect(screen.getByRole('button', { name: 'Retry Amazon Shipping' })).toBeDisabled();
    rerender(
      <QuoteProgress
        comparison={comparison('failed', [{ ...failed, retryBlockedReason: 'ship_date_passed' }])}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('button', { name: 'Retry Amazon Shipping' })).toBeDisabled();
    expect(screen.getByText(/Ship date has passed/)).toBeInTheDocument();
  });

  it('explains how to add missing browser contact details', () => {
    render(
      <QuoteProgress
        comparison={comparison('failed', [
          { ...attempt('failed', 'unishippers'), reasonCode: 'contact_details_required' },
        ])}
      />,
    );
    expect(
      screen
        .getAllByText(/enter the contact name and phone number/)
        .some((node) => node.closest('[role="alert"]')),
    ).toBe(true);
  });

  it('explains that a historical Amazon browser failure retries through API mode', () => {
    render(
      <QuoteProgress
        comparison={comparison('completed', [
          { ...attempt('failed', 'amazon'), reasonCode: 'verification_required' },
          attempt('completed', 'unishippers'),
        ])}
      />,
    );
    expect(
      screen
        .getAllByText(/retired Amazon browser flow/)
        .some((node) => node.closest('[role="alert"]')),
    ).toBe(true);
    expect(screen.getAllByText(/myUnishippers/).length).toBeGreaterThan(0);
  });

  it('explains how an admin can complete Amazon Shipping setup', () => {
    render(
      <QuoteProgress
        comparison={comparison('failed', [
          { ...attempt('failed', 'amazon'), reasonCode: 'provider_setup_required' },
        ])}
      />,
    );

    expect(
      screen
        .getAllByText(/retired Amazon browser onboarding flow/)
        .some((node) => node.closest('[role="alert"]')),
    ).toBe(true);
  });

  it('explains the sender-company correction without exposing a provider message', () => {
    render(
      <QuoteProgress
        comparison={comparison('failed', [
          {
            ...attempt('failed', 'unishippers'),
            reasonCode: 'sender_company_too_long',
          },
        ])}
      />,
    );

    expect(
      screen.getAllByText(/35 characters/).some((node) => node.closest('[role="alert"]')),
    ).toBe(true);
    expect(screen.getAllByText(/Copy to new comparison/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/account address is unchanged/).length).toBeGreaterThan(0);
  });

  it.each([
    ['queued', 'Waiting to request prices.'],
    ['running', 'Getting prices from providers.'],
    ['failed', 'No prices available. Review the provider messages below.'],
    ['completed', 'Completed.'],
  ] as const)('renders %s clearly', (status, label) => {
    render(<QuoteProgress comparison={comparison(status, [attempt(status)])} />);
    expect(screen.getByText(`${label} These details are read-only.`)).toBeInTheDocument();
  });

  it('retains partial results, labels simulations once, and expands price details', async () => {
    const success = {
      ...attempt('completed'),
      simulated: true,
      quotes: [
        {
          platform: 'Amazon Shipping',
          carrier: 'Simulated carrier',
          service: 'Ground',
          transportationTotal: '12.500000',
          currency: 'USD',
          estimateMethod: 'native' as const,
          transitDescription: null,
          retrievedAt: '2026-10-19T12:00:00.000Z',
          expiresAt: null,
          optionCoverage: 'unverified' as const,
          dutyStatus: 'unknown' as const,
          taxStatus: 'unknown' as const,
          clearanceStatus: 'unknown' as const,
          charges: [
            {
              description: 'BASE_CHARGE',
              amount: '7.830000',
              scope: 'package' as const,
              packageGroupPosition: 0,
            },
          ],
          groupContributions: [{ packageGroupPosition: 0, quantity: 2, subtotal: '27.620000' }],
        },
      ],
    };
    const { rerender } = render(
      <QuoteProgress
        comparison={comparison('running', [success, attempt('running', 'unishippers')])}
      />,
    );
    expect(screen.getByText(/Some prices are ready/)).toBeInTheDocument();
    expect(screen.getAllByText(/Amazon sandbox mode — test data/)).toHaveLength(1);
    expect(screen.getByText(/BASE_CHARGE: 7\.83 USD/)).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /What’s included in this price/ }));
    expect(screen.getByText(/BASE_CHARGE: 7\.83 USD/)).toBeVisible();
    rerender(
      <QuoteProgress
        comparison={comparison('completed', [
          success,
          { ...attempt('failed', 'unishippers'), reasonCode: 'SECRET' },
        ])}
      />,
    );
    expect(screen.getByText(/Completed with partial results/)).toBeInTheDocument();
    expect(screen.getByText(/\$12\.50/)).toHaveTextContent('$12.50 USD');
    expect(screen.getByText(/We could not confirm how long this price is valid/)).toBeVisible();
    expect(screen.getByText(/Single-package estimate/)).toBeInTheDocument();
    expect(screen.getByText(/BASE_CHARGE: 7\.83 USD/)).toBeInTheDocument();
    expect(screen.getByText(/Group 1: 2 box\(es\) · 27\.62 USD/)).toBeInTheDocument();
    expect(
      screen
        .getAllByText('The provider request failed.')
        .some((node) => node.closest('[role="alert"]')),
    ).toBe(true);
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  });

  it('prioritizes current prices, preserves ranking safeguards, and updates expiring prices', async () => {
    const origin = {
      name: 'Warehouse',
      street: '1 Example St',
      city: 'Walworth',
      division: 'WI',
      postalCode: '53125',
      country: 'US',
    };
    const quotes = ['amazon', 'unishippers'].map((provider, index) => ({
      ...attempt('completed', provider as 'amazon' | 'unishippers'),
      simulated: true,
      sender: {
        code: provider as 'amazon' | 'unishippers',
        address: origin,
        mode: 'explicit' as const,
        retrievedAt: null,
      },
      quotes: [
        {
          platform: provider === 'amazon' ? 'Amazon Shipping' : 'myUnishippers',
          carrier: provider,
          service: 'Ground',
          transportationTotal: index === 0 ? '18.500000' : '23.250000',
          currency: 'USD',
          estimateMethod: 'native' as const,
          transitDescription: '4 business days',
          retrievedAt: '2020-01-01T00:00:00Z',
          expiresAt: index === 0 ? null : '2099-01-01T00:00:00Z',
          staleAt: index === 0 ? '2020-01-02T00:00:00Z' : null,
          optionCoverage: 'included' as const,
          dutyStatus: 'excluded' as const,
          taxStatus: 'excluded' as const,
          clearanceStatus: 'excluded' as const,
          charges: [],
          groupContributions: [],
        },
      ],
    }));
    const value = comparison('completed', quotes);
    value.input = {
      providers: ['amazon', 'unishippers'].map((code) => ({
        code,
        options: { signature: 'none', insurance: null },
      })),
    } as Comparison['input'];
    const { rerender } = render(<QuoteProgress comparison={value} />);
    const stale = screen.getByRole('article', { name: /Amazon Shipping/ });
    const current = screen.getByRole('article', { name: /myUnishippers/ });
    expect(screen.getAllByRole('article')[0]).toBe(current);
    expect(within(stale).getByText(/18\.50/)).toBeVisible();
    expect(within(stale).getByText('Needs a new quote')).toBeVisible();
    expect(within(stale).queryByText('Lowest price', { exact: true })).not.toBeInTheDocument();
    expect(within(current).queryByText('Lowest price', { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Amazon sandbox mode — test data/)).toHaveLength(1);
    expect(screen.getByText('Simulated rates are excluded from Lowest price.')).toBeVisible();
    rerender(
      <QuoteProgress
        comparison={{
          ...value,
          attempts: value.attempts.map((a, i) => ({ ...a, simulated: i === 0 })),
        }}
      />,
    );
    expect(screen.getByText('Simulated rates are excluded from Lowest price.')).toBeVisible();
    expect(screen.queryByText('Lowest price', { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByText('Test price')).toHaveLength(1);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    // Remount with the controlled clock, then cross the provider expiry while visible.
    const almostExpired = {
      ...value,
      attempts: value.attempts.map((a) => ({
        ...a,
        quotes: a.quotes.map((quote) => ({
          ...quote,
          expiresAt: quote.expiresAt ? '2099-01-01T00:00:01Z' : null,
        })),
      })),
    };
    rerender(<QuoteProgress key="expiry" comparison={almostExpired} />);
    expect(screen.getByText('Current price')).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByText('Current price')).not.toBeInTheDocument();
    expect(screen.queryByText('Lowest price', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Expired — get a new quote')).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    vi.useRealTimers();
  });
});

it('retries a historical Amazon verification failure through the normal action', async () => {
  const onRetry = vi.fn();
  const failed = {
    ...attempt('failed'),
    reasonCode: 'verification_required',
    retryBlockedReason: null,
  };
  const { rerender } = render(
    <QuoteProgress comparison={comparison('failed', [failed])} onRetry={onRetry} />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Retry Amazon Shipping' }));
  expect(onRetry).toHaveBeenCalledWith(failed.externalId);
  rerender(
    <QuoteProgress
      comparison={comparison('failed', [{ ...failed, retryBlockedReason: 'ship_date_passed' }])}
      onRetry={onRetry}
    />,
  );
  expect(screen.getByRole('button', { name: 'Retry Amazon Shipping' })).toBeDisabled();
});
