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
const amazonProvider = {
  code: 'amazon' as const,
  name: 'Amazon Shipping',
  enabled: true,
  executionMode: 'request' as const,
  usedInternationally: false,
  internationalAvailable: false,
  supportsSignature: false,
  supportsInsurance: false,
};
const unishippersRequestProvider = {
  code: 'unishippers' as const,
  name: 'myUnishippers',
  enabled: true,
  executionMode: 'request' as const,
  usedInternationally: true,
  internationalAvailable: false,
  supportsSignature: false,
  supportsInsurance: false,
};
const unishippersBrowserProvider = {
  ...unishippersRequestProvider,
  executionMode: 'browser' as const,
  internationalAvailable: true,
  supportsSignature: true,
  supportsInsurance: true,
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
  it('copies the refreshed myUnishippers origin for a comparison-only correction', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const original = { ...address, name: 'A provider company name over 35 characters' };
    const body = initial();
    body.providers = [
      {
        code: 'unishippers',
        sender: { mode: 'account_default', refreshId: crypto.randomUUID() },
        options: { signature: 'none', insurance: null },
      },
    ];
    render(
      <QuoteForm
        providers={[unishippersRequestProvider]}
        initial={body}
        onSave={save}
        onRefresh={vi.fn().mockResolvedValue({
          refreshId: crypto.randomUUID(),
          address: original,
          retrievedAt: new Date().toISOString(),
        })}
      />,
    );

    await screen.findByText(/A provider company name over 35 characters.*Retrieved/);
    expect(screen.getByText(/Browser quotes use the full myUnishippers form/)).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'myUnishippers sender' }));
    await user.click(screen.getByRole('option', { name: 'Explicit sender' }));
    expect(screen.getByLabelText('myUnishippers origin name')).toHaveValue(original.name);
    expect(screen.getByText(/correction applies only to this comparison/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('myUnishippers origin contact name'), 'Shipping Contact');
    await user.type(screen.getByLabelText('myUnishippers origin phone number'), '2025550147');
    await user.type(
      screen.getByLabelText('myUnishippers receiver contact name'),
      'Receiving Contact',
    );
    await user.type(screen.getByLabelText('myUnishippers receiver phone number'), '2025550148');
    await user.clear(screen.getByLabelText('myUnishippers origin name'));
    await user.type(screen.getByLabelText('myUnishippers origin name'), 'Corrected company');
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: [
            expect.objectContaining({
              sender: {
                mode: 'explicit',
                address: expect.objectContaining({
                  ...original,
                  name: 'Corrected company',
                  contactName: 'Shipping Contact',
                  phone: '2025550147',
                }),
              },
            }),
          ],
          destination: expect.objectContaining({
            contactName: 'Receiving Contact',
            phone: '2025550148',
          }),
        }),
      ),
    );
    expect(original.name).toBe('A provider company name over 35 characters');
  });

  it('preserves original decimal strings and units on save and supports additional package groups', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <QuoteForm
        providers={[amazonProvider]}
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
    expect(screen.getByText(/Saving queues provider comparisons/)).toBeInTheDocument();
  });
  it('disables Amazon internationally and saves detailed customs with myUnishippers options', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const body = initial();
    body.destination = {
      ...body.destination,
      country: 'CA',
      division: 'BC',
      contactName: 'Receiving Contact',
      phone: '2025550148',
    };
    const international: QuoteInput = {
      ...body,
      international: {
        contentsDescription: 'Cotton shirts',
        customsMode: 'detailed',
        totalValue: { amount: '50.000000', currency: 'USD' },
      },
      providers: [
        {
          ...body.providers[0],
          code: 'unishippers' as const,
          sender: {
            mode: 'explicit' as const,
            address: {
              ...address,
              contactName: 'Shipping Contact',
              phone: '2025550147',
            },
          },
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
        providers={[amazonProvider, unishippersBrowserProvider]}
        initial={international}
        onSave={save}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Amazon Shipping' })).toBeDisabled();
    expect(screen.getByText('Not available for international destinations')).toBeInTheDocument();
    expect(screen.getByLabelText('Group 1 item 1 description')).toHaveValue('Cotton shirt');
    expect(screen.getByLabelText('Total customs value')).toHaveValue('50.000000');
    expect(screen.getByText(/Aggregate requested coverage: 100.00 USD/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          packageGroups: [
            expect.objectContaining({
              customsItems: [expect.objectContaining({ unitValue: '25.00', weight: '0.10' })],
            }),
          ],
          international: expect.objectContaining({
            contentsDescription: 'Cotton shirts',
            totalValue: { amount: '50.000000', currency: 'USD' },
          }),
        }),
      ),
    );
  });

  it('uses maintained country and region data for international addresses', async () => {
    const user = userEvent.setup();

    render(
      <QuoteForm
        providers={[amazonProvider]}
        initial={initial()}
        onSave={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Destination country' }));
    await user.click(screen.getByRole('option', { name: 'Canada' }));
    await user.click(screen.getByRole('combobox', { name: 'Destination state / province' }));

    expect(screen.getByRole('option', { name: 'British Columbia' })).toBeInTheDocument();
  });

  it('shows default refresh failure and permits an explicit sender fallback', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockRejectedValue(new Error('fixture'));
    render(<QuoteForm providers={[amazonProvider]} onSave={vi.fn()} onRefresh={onRefresh} />);
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
        providers={[amazonProvider]}
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

  it('allows all dimensions blank for myUnishippers request mode', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const body = initial();
    body.providers = [
      {
        code: 'unishippers',
        sender: { mode: 'explicit', address },
        options: { signature: 'none', insurance: null },
      },
    ];
    const group = body.packageGroups[0];
    if (!group) throw new Error('Missing package group fixture');
    body.packageGroups[0] = {
      ...group,
      length: '',
      width: '',
      height: '',
      weight: '51',
    };
    render(
      <QuoteForm
        providers={[unishippersRequestProvider]}
        initial={body}
        onSave={save}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/all three dimensions blank/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          packageGroups: [
            expect.objectContaining({ length: '', width: '', height: '', weight: '51' }),
          ],
        }),
      ),
    );
  });

  it.each([
    {
      name: 'partial dimensions in request mode',
      provider: unishippersRequestProvider,
      dimensions: { length: '10', width: '', height: '' },
    },
    {
      name: 'blank dimensions in browser mode',
      provider: { ...unishippersRequestProvider, executionMode: 'browser' as const },
      dimensions: { length: '', width: '', height: '' },
    },
    {
      name: 'blank dimensions for Amazon',
      provider: amazonProvider,
      dimensions: { length: '', width: '', height: '' },
    },
  ])('blocks $name', async ({ provider, dimensions }) => {
    const user = userEvent.setup();
    const save = vi.fn();
    const body = initial();
    body.providers = [
      {
        code: provider.code,
        sender: { mode: 'explicit', address },
        options: { signature: 'none', insurance: null },
      },
    ];
    const group = body.packageGroups[0];
    if (!group) throw new Error('Missing package group fixture');
    body.packageGroups[0] = { ...group, ...dimensions };
    render(<QuoteForm providers={[provider]} initial={body} onSave={save} onRefresh={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save comparison' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Package dimensions must include all three values or none/),
      ).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });
});

it('shows cached defaults as stale after refresh failure and blocks default submission', async () => {
  const body = initial();
  const selected = body.providers[0];
  if (!selected) throw new Error('Missing fixture provider');
  selected.sender = { mode: 'account_default', refreshId: crypto.randomUUID() };
  render(
    <QuoteForm
      providers={[
        {
          code: 'amazon',
          name: 'Amazon Shipping',
          enabled: true,
          executionMode: 'request',
          usedInternationally: false,
          internationalAvailable: false,
          supportsSignature: false,
          supportsInsurance: false,
          staleHours: 1,
          cachedDefault: { address, retrievedAt: '2026-10-19T12:00:00Z' },
        },
      ]}
      initial={body}
      onSave={vi.fn()}
      onRefresh={vi.fn().mockRejectedValue(new Error('unavailable'))}
    />,
  );
  expect(await screen.findByText(/Stale default/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save comparison' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Refresh Amazon Shipping default' }),
  ).toBeInTheDocument();
});

it('expires a refreshed default and displays disabled-provider maintenance', async () => {
  const body = initial();
  const selected = body.providers[0];
  if (!selected) throw new Error('Missing fixture provider');
  selected.sender = { mode: 'account_default', refreshId: crypto.randomUUID() };
  const configuration = {
    code: 'amazon' as const,
    name: 'Amazon Shipping',
    enabled: true,
    executionMode: 'request' as const,
    usedInternationally: false,
    internationalAvailable: false,
    supportsSignature: false,
    supportsInsurance: false,
    staleHours: 1,
  };
  render(
    <QuoteForm
      providers={[
        configuration,
        {
          ...configuration,
          code: 'unishippers',
          name: 'myUnishippers',
          enabled: false,
          maintenanceMessage: 'Provider maintenance',
        },
      ]}
      initial={body}
      onSave={vi.fn()}
      onRefresh={vi.fn().mockResolvedValue({
        refreshId: crypto.randomUUID(),
        address,
        retrievedAt: new Date().toISOString(),
        expiresAt: '2020-01-01T00:00:00Z',
      })}
    />,
  );
  expect(await screen.findByText(/Stale default/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save comparison' })).toBeDisabled();
  expect(screen.getByText(/myUnishippers is disabled. Provider maintenance/)).toBeInTheDocument();
});
