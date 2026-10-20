import { businessCalendarDate } from '@lib/dates';
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
const initial = (): QuoteInput => ({
  idempotencyKey: crypto.randomUUID(),
  shipDate: businessCalendarDate(),
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
  it('renders when randomUUID is unavailable on an HTTP deployment', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });

    try {
      render(<QuoteForm providers={[]} onSave={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Save comparison' })).toBeVisible();
    } finally {
      if (descriptor) Object.defineProperty(globalThis.crypto, 'randomUUID', descriptor);
      else Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
    }
  });

  it('requires a user-entered sender and removes the account-default choice', async () => {
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
    render(<QuoteForm providers={[unishippersRequestProvider]} initial={body} onSave={save} />);

    expect(screen.queryByText(/Account default/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Enter the sender for this comparison/)).toBeInTheDocument();
    expect(screen.getByText(/Quick Quote prices one box/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('myUnishippers origin name'));
    await user.type(screen.getByLabelText('myUnishippers origin name'), 'Entered warehouse');
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: [
            expect.objectContaining({
              sender: {
                mode: 'explicit',
                address: expect.objectContaining({
                  ...address,
                  name: 'Entered warehouse',
                }),
              },
            }),
          ],
        }),
      ),
    );
  });

  it('rejects future dates for myUnishippers Quick Quote', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const body = initial();
    body.shipDate = '2099-10-19';
    body.providers = [
      {
        code: 'unishippers',
        sender: { mode: 'explicit', address },
        options: { signature: 'none', insurance: null },
      },
    ];
    render(<QuoteForm providers={[unishippersRequestProvider]} initial={body} onSave={save} />);

    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    expect(await screen.findByText(/Check required addresses/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('preserves original decimal strings and units on save and supports additional package groups', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<QuoteForm providers={[amazonProvider]} initial={initial()} onSave={save} />);
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
  it('disables domestic-only providers for international destinations', async () => {
    const user = userEvent.setup();
    const body = initial();
    render(
      <QuoteForm
        providers={[amazonProvider, unishippersRequestProvider]}
        initial={body}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Destination country' }));
    await user.click(screen.getByRole('option', { name: 'Canada' }));

    expect(screen.getByRole('checkbox', { name: 'Amazon Shipping' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'myUnishippers' })).toBeDisabled();
    expect(screen.getByText('Not available for international destinations')).toBeInTheDocument();
  });

  it('uses maintained country and region data for international addresses', async () => {
    const user = userEvent.setup();

    render(<QuoteForm providers={[amazonProvider]} initial={initial()} onSave={vi.fn()} />);

    await user.click(screen.getByRole('combobox', { name: 'Destination country' }));
    await user.click(screen.getByRole('option', { name: 'Canada' }));
    await user.click(screen.getByRole('combobox', { name: 'Destination state / province' }));

    expect(screen.getByRole('option', { name: 'British Columbia' })).toBeInTheDocument();
  });

  it('starts new providers with explicit sender fields', async () => {
    const user = userEvent.setup();
    render(<QuoteForm providers={[amazonProvider]} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Amazon Shipping origin street')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^Amazon Shipping$/ }));
    expect(screen.queryByLabelText('Amazon Shipping origin street')).not.toBeInTheDocument();
  });
  it('rejects a historical account default if passed directly to the new form', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const body = initial();
    body.providers = [
      {
        code: 'amazon',
        sender: { mode: 'account_default', refreshId: crypto.randomUUID() },
        options: { signature: 'none', insurance: null },
      },
    ];
    render(<QuoteForm providers={[amazonProvider]} initial={body} onSave={save} />);
    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    expect(await screen.findByText(/Check required addresses/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('requires dimensions for myUnishippers Quick Quote', async () => {
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
    render(<QuoteForm providers={[unishippersRequestProvider]} initial={body} onSave={save} />);

    await user.click(screen.getByRole('button', { name: 'Save comparison' }));
    expect(await screen.findByText(/Package dimensions must include/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
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
    render(<QuoteForm providers={[provider]} initial={body} onSave={save} />);

    await user.click(screen.getByRole('button', { name: 'Save comparison' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Package dimensions must include all three positive values/),
      ).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });
});

it('displays disabled-provider maintenance without offering its sender fields', () => {
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
      onSave={vi.fn()}
    />,
  );
  expect(screen.getByText(/myUnishippers is disabled. Provider maintenance/)).toBeInTheDocument();
  expect(screen.queryByLabelText('myUnishippers origin street')).not.toBeInTheDocument();
});
