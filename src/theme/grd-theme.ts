import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';

export const THEME_MODE_STORAGE_KEY = 'grd-theme-mode';

export const grdTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'data-grd-color-scheme',
    cssVarPrefix: 'grd',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: '#0152A0',
          dark: '#003E79',
          light: '#3977B3',
          contrastText: '#FFFFFF',
        },
        secondary: {
          main: '#F8D287',
          dark: '#C7A251',
          light: '#FBE3B4',
          contrastText: '#2B2B2B',
        },
        background: {
          default: '#F4F7F9',
          paper: '#FFFFFF',
        },
        text: {
          primary: '#2B2B2B',
          secondary: '#566675',
        },
        divider: '#D7DEE5',
        success: { main: '#237A46' },
        warning: { main: '#946200' },
        error: { main: '#B42318' },
        info: { main: '#0152A0' },
      },
    },
    dark: {
      palette: {
        primary: {
          main: '#70B7F4',
          dark: '#397EB9',
          light: '#A9D5FA',
          contrastText: '#071A2B',
        },
        secondary: {
          main: '#F8D287',
          dark: '#C7A251',
          light: '#FBE3B4',
          contrastText: '#2B2B2B',
        },
        background: {
          default: '#0D1721',
          paper: '#152431',
        },
        text: {
          primary: '#F3F7FA',
          secondary: '#B8C5CF',
        },
        divider: '#344756',
        success: { main: '#66C58A' },
        warning: { main: '#F8D287' },
        error: { main: '#FF8A80' },
        info: { main: '#70B7F4' },
      },
    },
  },
  typography: {
    fontFamily: '"Open Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: 'clamp(1.75rem, 1.4rem + 1vw, 2.25rem)',
      fontWeight: 700,
      letterSpacing: '-0.025em',
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    button: {
      fontWeight: 650,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          minHeight: '100%',
        },
        body: {
          minHeight: '100%',
          margin: 0,
        },
        '#root': {
          minHeight: '100vh',
        },
        '::selection': {
          backgroundColor: 'rgba(248, 210, 135, 0.7)',
          color: '#2B2B2B',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            scrollBehavior: 'auto !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
