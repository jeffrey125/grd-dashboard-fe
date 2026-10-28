import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ShipmentFilters } from './filters';

it('requires Apply and keeps the carrier draft through live data changes', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  const carrier = {
    externalId: '5cf5db63-ef5e-4f1d-8462-61f7e060532c',
    name: 'UPS',
    isActive: true,
  };
  const raw = { q: '001', page: '3' };
  const view = render(
    <ShipmentFilters raw={raw} carriers={[carrier]} onApply={apply} onClear={vi.fn()} />,
  );
  expect(screen.queryByLabelText('Latest lookup')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Created from')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Created to')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Delivery from')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Delivery to')).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Carrier'), carrier.externalId);
  expect(apply).not.toHaveBeenCalled();
  view.rerender(
    <ShipmentFilters
      raw={{ ...raw, q: '002' }}
      carriers={[carrier]}
      onApply={apply}
      onClear={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('Carrier')).toHaveValue(carrier.externalId);
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({ carrierExternalId: carrier.externalId, q: '002', page: '1' }),
  );
});
it('requires explicit correction of an invalid URL page rather than silently resetting it', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  render(<ShipmentFilters raw={{ page: '-1' }} carriers={[]} onApply={apply} onClear={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Clear page' }));
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ page: '1' }));
});

it('keeps invalid removed URL filters visible and blocked until explicitly cleared', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  render(
    <ShipmentFilters
      raw={{ createdFrom: '2025-02-29' }}
      carriers={[]}
      onApply={apply}
      onClear={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('URL value: createdFrom')).toHaveValue('2025-02-29');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Clear createdFrom' }));
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith({ page: '1' });
});

it('keeps multiple rep drafts, inactive choices and unassigned until Apply, then clears', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  const clear = vi.fn();
  const reps = [
    {
      externalId: '00000000-0000-4000-8000-000000000001',
      firstName: 'Alice',
      lastName: 'Active',
      active: true,
    },
    {
      externalId: '00000000-0000-4000-8000-000000000002',
      firstName: 'Bob',
      lastName: 'Former',
      active: false,
    },
  ];
  const view = render(
    <ShipmentFilters
      raw={{ page: '3' }}
      carriers={[]}
      salesReps={reps}
      onApply={apply}
      onClear={clear}
    />,
  );
  const input = screen.getByRole('combobox', { name: 'Sales Reps' });
  await user.click(input);
  await user.click(screen.getByRole('option', { name: 'Alice Active' }));
  await user.click(screen.getByRole('option', { name: 'Bob Former (inactive)' }));
  await user.click(screen.getByRole('option', { name: 'Unassigned' }));
  expect(apply).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  view.rerender(
    <ShipmentFilters
      raw={{ page: '3' }}
      carriers={[]}
      salesReps={[...reps]}
      onApply={apply}
      onClear={clear}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith({
    page: '1',
    salesRepExternalIds: `${reps[0]?.externalId},${reps[1]?.externalId},unassigned`,
  });
  await user.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(clear).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenLastCalledWith({ page: '1' });
});

it('preserves selected rep IDs while options are unavailable', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  const id = '00000000-0000-4000-8000-000000000001';
  render(
    <ShipmentFilters
      raw={{ salesRepExternalIds: id }}
      carriers={[]}
      onApply={apply}
      onClear={vi.fn()}
    />,
  );
  expect(screen.getByText(`${id} (unavailable or invalid)`)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith({ page: '1', salesRepExternalIds: id });
});
