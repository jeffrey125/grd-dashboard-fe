import { NotificationProvider } from '@components/feedback/notification-provider';
import { businessCalendarDate } from '@lib/dates';
import { render as renderUi, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QuoteForm } from './quote-form';
import type { QuoteInput } from './schemas';

const render = (ui: ReactElement) => renderUi(<NotificationProvider>{ui}</NotificationProvider>);

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
  executionMode: 'api' as const,
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
      expect(screen.getByRole('button', { name: 'Compare quotes' })).toBeVisible();
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
    expect(screen.getByText(/Enter the pickup address once/)).toBeInTheDocument();
    expect(
      screen.getByText(/We estimate the total by multiplying each box price/),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Sender company or name/));
    await user.type(screen.getByLabelText(/Sender company or name/), 'Entered warehouse');
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
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

    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    expect(
      await screen.findByText(/Please check the highlighted fields below/),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('preserves original decimal strings and units on save and supports additional package groups', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<QuoteForm providers={[amazonProvider]} initial={initial()} onSave={save} />);
    expect(screen.getByLabelText(/Box type 1: length/)).toHaveValue('10.00');
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          packageGroups: [
            expect.objectContaining({ units: 'metric', length: '10.00', quantity: 2 }),
          ],
        }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Add another box type' }));
    expect(screen.getByLabelText(/Box type 2: length/)).toBeInTheDocument();
    expect(screen.getByText(/This does not book a shipment/)).toBeInTheDocument();
  });
  it('keeps both countries US-only and preserves the shared sender through deselecting all providers', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <QuoteForm
        providers={[amazonProvider, unishippersRequestProvider]}
        initial={initial()}
        onSave={save}
      />,
    );
    expect(screen.getByLabelText('Recipient country')).toHaveValue('United States');
    expect(screen.getByLabelText('Recipient country')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Sender country')).toHaveAttribute('readonly');
    await user.clear(screen.getByLabelText(/Sender company or name/));
    await user.type(screen.getByLabelText(/Sender company or name/), 'Shared warehouse');
    await user.click(screen.getByRole('checkbox', { name: 'Amazon Shipping' }));
    expect(screen.getByLabelText(/Sender company or name/)).toHaveValue('Shared warehouse');
    await user.click(screen.getByRole('checkbox', { name: 'myUnishippers' }));
    await user.click(screen.getByRole('checkbox', { name: 'Amazon Shipping' }));
    expect(screen.getAllByLabelText(/Sender company or name/)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const submitted = save.mock.calls[0]?.[0] as QuoteInput;
    expect(submitted.providers).toHaveLength(2);
    expect(submitted.providers[0]?.sender).toEqual(submitted.providers[1]?.sender);
    expect(submitted.providers[0]?.sender).toMatchObject({ address: { name: 'Shared warehouse' } });
  });

  it('uses US state options from the installed region data', async () => {
    const user = userEvent.setup();
    render(<QuoteForm providers={[amazonProvider]} initial={initial()} onSave={vi.fn()} />);
    await user.click(screen.getByRole('combobox', { name: 'Recipient state / province' }));
    expect(screen.getByRole('option', { name: 'Wisconsin' })).toBeInTheDocument();
  });

  it('requires a shared contact field only while its provider is selected', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const requirements = {
      sender: { requiredFields: ['phone' as const], maxNameLength: 35 },
      destination: { requiredFields: [], maxNameLength: 200 },
    };
    render(
      <QuoteForm
        providers={[
          amazonProvider,
          { ...unishippersRequestProvider, inputRequirements: requirements },
        ]}
        initial={initial()}
        onSave={save}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'myUnishippers' }));
    expect(screen.getByLabelText(/^Sender phone/)).toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Sender phone/)).toHaveAccessibleDescription(
        'Required by myUnishippers',
      ),
    );
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: 'myUnishippers' }));
    expect(screen.getByLabelText(/^Sender phone/)).not.toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
  });

  it('applies shared options only to supporting services and flags unsupported services', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <QuoteForm
        providers={[
          { ...amazonProvider, supportsSignature: true, supportsInsurance: true },
          unishippersRequestProvider,
        ]}
        initial={initial()}
        onSave={save}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'myUnishippers' }));
    await user.click(screen.getByRole('combobox', { name: /Signature request/ }));
    await user.click(screen.getByRole('option', { name: /^Signature$/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Request insurance' }));
    await user.type(screen.getByLabelText(/Insured value per box/), '25');
    expect(screen.getByText(/Signature will not be requested from myUnishippers/)).toBeVisible();
    expect(screen.getByText(/Insurance will not be requested from myUnishippers/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const submitted = save.mock.calls[0]?.[0] as QuoteInput;
    expect(submitted.providers[0]?.options).toEqual({
      signature: 'signature',
      insurance: { amount: '25', currency: 'USD' },
    });
    expect(submitted.providers[1]?.options).toEqual({ signature: 'none', insurance: null });
  });

  it('validates the shared sender against the selected provider name limit', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const body = initial();
    body.providers[0] = {
      code: 'unishippers',
      sender: { mode: 'explicit', address: { ...address, name: 'A'.repeat(36) } },
      options: { signature: 'none', insurance: null },
    };
    render(<QuoteForm providers={[unishippersRequestProvider]} initial={body} onSave={save} />);
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Sender company or name/)).toHaveAccessibleDescription(
        'myUnishippers requires 35 characters or fewer',
      ),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('validates Amazon API address and physical-package limits before saving', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const body = initial();
    body.destination = {
      ...address,
      name: 'N'.repeat(51),
      street: 'S'.repeat(61),
      contactName: 'C'.repeat(51),
    };
    const group = body.packageGroups[0];
    if (!group) throw new Error('Missing package group fixture');
    group.quantity = 101;
    render(<QuoteForm providers={[amazonProvider]} initial={body} onSave={save} />);

    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));

    await waitFor(() =>
      expect(screen.getByLabelText(/Recipient company or name/)).toHaveAccessibleDescription(
        'Amazon Shipping requires 50 characters or fewer',
      ),
    );
    expect(screen.getByLabelText(/Recipient address/)).toHaveAccessibleDescription(
      'Amazon Shipping requires 60 characters or fewer',
    );
    expect(screen.getByLabelText(/Recipient contact name/)).toHaveAccessibleDescription(
      'Amazon Shipping requires 50 characters or fewer',
    );
    expect(save).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
    expect(
      await screen.findByText(/Please check the highlighted fields below/),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('allows blank dimensions for myUnishippers-only Quick Quote', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
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

    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));

    await waitFor(() => expect(screen.getByLabelText(/Box type 1: width/)).toBeInvalid());
    expect(save).not.toHaveBeenCalled();
  });

  it('requires dimensions when Amazon and myUnishippers are selected together', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const body = initial();
    body.providers.push({
      code: 'unishippers',
      sender: { mode: 'explicit', address },
      options: { signature: 'none', insurance: null },
    });
    const group = body.packageGroups[0];
    if (!group) throw new Error('Missing package group fixture');
    body.packageGroups[0] = { ...group, length: '', width: '', height: '' };
    render(
      <QuoteForm
        providers={[amazonProvider, unishippersRequestProvider]}
        initial={body}
        onSave={save}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Compare quotes' }));

    await waitFor(() => expect(screen.getByLabelText(/Box type 1: length/)).toBeInvalid());
    expect(save).not.toHaveBeenCalled();
  });
});

it('displays disabled-provider maintenance without offering its sender fields', () => {
  const configuration = {
    code: 'amazon' as const,
    name: 'Amazon Shipping',
    enabled: true,
    executionMode: 'api' as const,
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
  expect(screen.queryByLabelText(/myUnishippers sender address/)).not.toBeInTheDocument();
});

it('shows a toast, marks missing fields, focuses the first error and clears field errors after correction', async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  const body = initial();
  body.destination = { ...address, name: '' };
  body.packageGroups = body.packageGroups.map((group) => ({ ...group, weight: '' }));
  render(<QuoteForm providers={[amazonProvider]} initial={body} onSave={save} />);
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  expect(
    await screen.findByText(
      'Please complete or correct the highlighted fields before comparing quotes.',
    ),
  ).toBeVisible();
  const name = screen.getByLabelText(/Recipient company or name/);
  const weight = screen.getByLabelText(/Box type 1: weight/);
  expect(name).toBeInvalid();
  expect(name).toHaveAccessibleDescription('This field is required');
  expect(name).toHaveFocus();
  expect(weight).toBeInvalid();
  expect(weight).toHaveAccessibleDescription(/Enter a number greater than 0/);
  expect(save).not.toHaveBeenCalled();
  await user.type(name, 'Receiving warehouse');
  await waitFor(() => expect(name).not.toBeInvalid());
  expect(weight).toBeInvalid();
  await user.type(weight, '5');
  await waitFor(() => expect(weight).not.toBeInvalid());
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
});

it('keeps addresses and shows a safe server failure in both the page and toast', async () => {
  const user = userEvent.setup();
  render(
    <QuoteForm
      providers={[amazonProvider]}
      initial={initial()}
      onSave={vi.fn().mockRejectedValue(new Error('private provider data'))}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  await waitFor(() =>
    expect(screen.getAllByText('Unable to complete the request. Try again.')).toHaveLength(2),
  );
  expect(screen.queryByText('private provider data')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Recipient company or name/)).toHaveValue(address.name);
});

it('explains missing service selection next to the choices', async () => {
  const user = userEvent.setup();
  render(<QuoteForm providers={[amazonProvider]} initial={initial()} onSave={vi.fn()} />);
  await user.click(screen.getByRole('checkbox', { name: 'Amazon Shipping' }));
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  expect(await screen.findByText('Select at least one shipping service')).toBeVisible();
});

it('shows errors on the correct added box and clears a removed box error', async () => {
  const user = userEvent.setup();
  render(<QuoteForm providers={[amazonProvider]} initial={initial()} onSave={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Add another box type' }));
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  await waitFor(() => expect(screen.getByLabelText(/Box type 2: weight/)).toBeInvalid());
  expect(screen.getByLabelText(/Box type 1: weight/)).not.toBeInvalid();
  await user.click(screen.getByRole('button', { name: 'Remove box type 2' }));
  expect(screen.queryByLabelText(/Box type 2: weight/)).not.toBeInTheDocument();
});

it('blocks a copied international destination without silently changing its country', async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  const body = initial();
  body.destination = { ...address, country: 'CA', division: 'ON', postalCode: 'M5V 2T6' };
  render(<QuoteForm providers={[amazonProvider]} initial={body} onSave={save} />);
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  expect(await screen.findByText('V1 supports US destinations only')).toBeVisible();
  expect(screen.queryByText('International shipping details')).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it('explains invalid box quantities and dimensions beside the fields', async () => {
  const user = userEvent.setup();
  const body = initial();
  body.packageGroups = body.packageGroups.map((group) => ({
    ...group,
    quantity: 1.5,
    width: '-2',
  }));
  render(<QuoteForm providers={[amazonProvider]} initial={body} onSave={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Compare quotes' }));
  await waitFor(() =>
    expect(screen.getByLabelText(/number of identical boxes/)).toHaveAccessibleDescription(
      'Enter a whole number',
    ),
  );
  expect(screen.getByLabelText(/Box type 1: width/)).toHaveAccessibleDescription(
    /Enter a number greater than 0/,
  );
});
