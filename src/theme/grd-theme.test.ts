import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import { grdTheme } from './grd-theme';

describe('GRD theme', () => {
  it('preserves the official blue and gold in the light color scheme', () => {
    const light = grdTheme.colorSchemes.light;
    expect(light).toBeDefined();
    if (!light) throw new Error('The light color scheme is missing.');
    const palette = light.palette;
    expect(palette.primary.main).toBe('#0152A0');
    expect(palette.secondary.main).toBe('#F8D287');
  });

  it('keeps primary and gold controls readable in both color schemes', () => {
    const schemes = [grdTheme.colorSchemes.light, grdTheme.colorSchemes.dark];
    for (const scheme of schemes) {
      expect(scheme).toBeDefined();
      if (!scheme) throw new Error('A required color scheme is missing.');
      expect(
        getContrastRatio(scheme.palette.primary.main, scheme.palette.primary.contrastText),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(scheme.palette.secondary.main, scheme.palette.secondary.contrastText),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
