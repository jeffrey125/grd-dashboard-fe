import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ShipmentFilters } from './filters';

it('requires Apply, explains reversed dates, and keeps drafts through live data changes', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  const raw = { createdFrom: '2026-10-20', createdTo: '2026-10-10', q: '001', page: '3' };
  const view = render(
    <ShipmentFilters raw={raw} carriers={[]} onApply={apply} onClear={vi.fn()} />,
  );
  expect(screen.getByText('End date must be on or after start date.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Choose created to' }));
  await user.click(screen.getByRole('gridcell', { name: /^30$/ }));
  const accept = screen.queryByRole('button', { name: 'OK' });
  if (accept) await user.click(accept);
  expect(apply).not.toHaveBeenCalled();
  view.rerender(
    <ShipmentFilters raw={{ ...raw, q: '002' }} carriers={[]} onApply={apply} onClear={vi.fn()} />,
  );
  expect(await screen.findByRole('group', { name: 'Created to' })).toHaveTextContent(
    /2026.*10.*30/,
  );
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({ createdTo: '2026-10-30', q: '002', page: '1' }),
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

it('keeps impossible bookmarked dates visible and blocked until explicitly cleared', async () => {
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
  expect(screen.getByText(/Invalid date: 2025-02-29/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Clear created from' }));
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenCalledWith({ page: '1' });
});
