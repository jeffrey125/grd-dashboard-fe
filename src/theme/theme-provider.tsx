import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { type ReactNode, useEffect } from 'react';

import { grdTheme, THEME_MODE_STORAGE_KEY } from './grd-theme';
import { grdThemeStorageManager } from './theme-storage';

function ThemeBrandAssets() {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === 'system' ? systemMode : mode;

  useEffect(() => {
    if (resolved !== 'dark' && resolved !== 'light') return;
    const favicon = document.querySelector<HTMLLinkElement>('#grd-favicon');
    if (favicon) favicon.href = resolved === 'dark' ? '/favicon-dark.svg' : '/favicon.svg';
  }, [resolved]);

  return null;
}

export function GrdThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      theme={grdTheme}
      defaultMode="system"
      modeStorageKey={THEME_MODE_STORAGE_KEY}
      storageManager={grdThemeStorageManager}
      disableTransitionOnChange
    >
      <ThemeBrandAssets />
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
