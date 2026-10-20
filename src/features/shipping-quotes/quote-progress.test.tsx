import { render, screen } from '@testing-library/react';
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
  executionMode: 'request',
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
    expect(screen.getByText(/Attempt 1 · Mode: request/)).toBeInTheDocument();
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
    expect(screen.getByText(/enter the contact name and phone number/)).toBeInTheDocument();
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

    expect(screen.getByText(/35 characters/)).toBeInTheDocument();
    expect(screen.getByText(/Copy to new comparison/)).toBeInTheDocument();
    expect(screen.getByText(/account address is unchanged/)).toBeInTheDocument();
  });

  it.each([
    ['queued', 'Queued — waiting for the worker.'],
    ['running', 'Running — requesting provider results.'],
    ['failed', 'Failed — no rates available.'],
    ['completed', 'Completed.'],
  ] as const)('renders %s clearly', (status, label) => {
    render(<QuoteProgress comparison={comparison(status, [attempt(status)])} />);
    expect(screen.getByText(`${label} These details are read-only.`)).toBeInTheDocument();
  });

  it('retains partial results, labels simulations, and uses safe failure messages', () => {
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
    expect(screen.getByText(/Partial results/)).toBeInTheDocument();
    expect(screen.getByText(/Simulated rates/)).toBeInTheDocument();
    rerender(
      <QuoteProgress
        comparison={comparison('completed', [
          success,
          { ...attempt('failed', 'unishippers'), reasonCode: 'SECRET' },
        ])}
      />,
    );
    expect(screen.getByText(/Completed with partial results/)).toBeInTheDocument();
    expect(screen.getByText(/12.500000 USD/)).toBeInTheDocument();
    expect(screen.getByText(/Single-package estimate/)).toBeInTheDocument();
    expect(screen.getByText(/BASE_CHARGE: 7.830000 USD/)).toBeInTheDocument();
    expect(screen.getByText(/Group 1: 2 box\(es\) · 27.620000 USD/)).toBeInTheDocument();
    expect(screen.getByText('The provider request failed.')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  });
});
