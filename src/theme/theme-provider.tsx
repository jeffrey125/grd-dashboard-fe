import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { grdTheme, THEME_MODE_STORAGE_KEY } from './grd-theme';
import { grdThemeStorageManager } from './theme-storage';

export function GrdThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      theme={grdTheme}
      defaultMode="system"
      modeStorageKey={THEME_MODE_STORAGE_KEY}
      storageManager={grdThemeStorageManager}
      disableTransitionOnChange
    >
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
