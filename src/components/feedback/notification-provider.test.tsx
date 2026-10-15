import Button from '@mui/material/Button';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrdThemeProvider } from '@theme/theme-provider';
import { expect, it } from 'vitest';

import { NotificationProvider, useNotifications } from './notification-provider';

function NotificationHarness() {
  const { showNotification } = useNotifications();
  return (
    <Button onClick={() => showNotification({ message: 'Shipment saved', severity: 'success' })}>
      Save
    </Button>
  );
}

it('exposes action feedback through the shared notification interface', async () => {
  const user = userEvent.setup();
  render(
    <GrdThemeProvider>
      <NotificationProvider>
        <NotificationHarness />
      </NotificationProvider>
    </GrdThemeProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shipment saved');
  expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
});
