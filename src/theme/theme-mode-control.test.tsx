import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import { THEME_MODE_STORAGE_KEY } from './grd-theme';
import { ThemeModeControl } from './theme-mode-control';
import { GrdThemeProvider } from './theme-provider';

it('persists explicit modes and allows returning to the system preference', async () => {
  const user = userEvent.setup();
  render(
    <GrdThemeProvider>
      <ThemeModeControl />
    </GrdThemeProvider>,
  );

  await user.click(screen.getByRole('button', { name: /Choose theme/ }));
  await user.click(screen.getByRole('menuitem', { name: 'Dark' }));
  await waitFor(() => expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark'));

  await user.click(screen.getByRole('button', { name: /Current theme: dark/ }));
  await user.click(screen.getByRole('menuitem', { name: 'System' }));
  await waitFor(() => expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBeNull());
});
