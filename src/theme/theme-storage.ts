import type { StorageManager } from '@mui/material/styles';

import { THEME_MODE_STORAGE_KEY } from './grd-theme';

const noOp = () => {};

export const grdThemeStorageManager: StorageManager = ({ key, storageWindow }) => {
  const targetWindow = storageWindow ?? (typeof window === 'undefined' ? undefined : window);

  return {
    get(defaultValue) {
      if (!targetWindow) return defaultValue;
      try {
        return targetWindow.localStorage.getItem(key) || defaultValue;
      } catch {
        return defaultValue;
      }
    },
    set(value) {
      if (!targetWindow) return;
      try {
        if (key === THEME_MODE_STORAGE_KEY && value === 'system') {
          targetWindow.localStorage.removeItem(key);
        } else {
          targetWindow.localStorage.setItem(key, String(value));
        }
      } catch {
        // Storage is optional; the active in-memory mode remains usable.
      }
    },
    subscribe(handler) {
      if (!targetWindow) return noOp;
      const listener = (event: StorageEvent) => {
        if (event.key === key) handler(event.newValue);
      };
      targetWindow.addEventListener('storage', listener);
      return () => targetWindow.removeEventListener('storage', listener);
    },
  };
};
