import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuoteForm } from './quote-form';
import type { QuoteInput } from './schemas';

const address = {
  name: 'Test warehouse',
  street: '1 Example Street',
  city: 'Walworth',
  division: 'WI',
  postalCode: '53125',
  country: 'US' as const,
};
const initial = (): QuoteInput => ({
  idempotencyKey: crypto.randomUUID(),
  shipDate: '2099-10-19',
  destination: address,
  providers: [
    {
      code: 'amazon' as const,
      sender: { mode: 'explicit' as const, address },
      options: { signature: 'none' as const, insurance: null },
    },
  ],
  packageGroups: [
    {
      quantity: 2,
      units: 'metric' as const,
      length: '10.00',
      width: '8',
      height: '6',
      weight: '5',
      customsItems: [],
    },
  ],
});

describe('Quote comparison form', () => {
  it('preserves original decimal strings and units on save and supports additional package groups', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <QuoteForm
        providers={[{ code: 'amazon', name: 'Amazon Shipping', enabled: true }]}
        initial={initial()}
        onSave={save}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Group 1 length')).toHaveValue('10.00');
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          packageGroups: [
            expect.objectContaining({ units: 'metric', length: '10.00', quantity: 2 }),
          ],
        }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Add package group' }));
    expect(screen.getByLabelText('Group 2 length')).toBeInTheDocument();
    expect(screen.getByText(/Provider support unverified/)).toBeInTheDocument();
  });
  it('preserves customs and provider options while warning about unverified coverage', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const body = initial();
    body.destination = { ...body.destination, country: 'CA' };
    const international = {
      ...body,
      providers: [
        {
          ...body.providers[0],
          code: 'amazon' as const,
          sender: { mode: 'explicit' as const, address },
          options: {
            signature: 'signature' as const,
            insurance: { amount: '50.00', currency: 'USD' },
          },
        },
      ],
      packageGroups: [
        {
          ...body.packageGroups[0],
          quantity: 2,
          units: 'metric' as const,
          length: '10.00',
          width: '8',
          height: '6',
          weight: '5',
          customsItems: [
            {
              description: 'Cotton shirt',
              quantity: 1,
              unitValue: '25.00',
              currency: 'USD',
              countryOfManufacture: 'US',
              weight: '0.10',
            },
          ],
        },
      ],
    };
    render(
      <QuoteForm
        providers={[{ code: 'amazon', name: 'Amazon Shipping', enabled: true }]}
        initial={international}
        onSave={save}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Group 1 item 1 description')).toHaveValue('Cotton shirt');
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          packageGroups: [
            expect.objectContaining({
              customsItems: [expect.objectContaining({ unitValue: '25.00', weight: '0.10' })],
            }),
          ],
        }),
      ),
    );
  });

  it('shows default refresh failure and permits an explicit sender fallback', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockRejectedValue(new Error('fixture'));
    render(
      <QuoteForm
        providers={[{ code: 'amazon', name: 'Amazon Shipping', enabled: true }]}
        onSave={vi.fn()}
        onRefresh={onRefresh}
      />,
    );
    await screen.findByText(/Enter an explicit sender/);
    await user.click(screen.getByRole('combobox', { name: 'Amazon Shipping sender' }));
    await user.click(screen.getByRole('option', { name: 'Explicit sender' }));
    expect(screen.getByLabelText('Amazon Shipping origin street')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^Amazon Shipping$/ }));
    expect(screen.queryByLabelText('Amazon Shipping origin street')).not.toBeInTheDocument();
  });
  it('cannot save a copied account default before its new refresh succeeds', async () => {
    const save = vi.fn();
    const body = initial();
    body.providers = [
      {
        code: 'amazon',
        sender: { mode: 'account_default', refreshId: crypto.randomUUID() },
        options: { signature: 'none', insurance: null },
      },
    ];
    render(
      <QuoteForm
        providers={[{ code: 'amazon', name: 'Amazon Shipping', enabled: true }]}
        initial={body}
        onSave={save}
        onRefresh={() => new Promise(() => {})}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save comparison' })).toBeDisabled(),
    );
    expect(save).not.toHaveBeenCalled();
  });
});
