import { BrandLogo } from '@components/layout/brand-logo';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeModeControl } from '@theme/theme-mode-control';
import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 460, p: { xs: 2, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <BrandLogo linked={false} />
            <ThemeModeControl />
          </Stack>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {children}
        </Stack>
      </Paper>
    </Box>
  );
}
