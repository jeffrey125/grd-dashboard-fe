import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export type PageBreadcrumb = {
  label: string;
  href?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: PageBreadcrumb[];
  actions?: ReactNode;
}) {
  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {breadcrumbs.length > 0 ? (
        <Breadcrumbs aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) =>
            item.href && index < breadcrumbs.length - 1 ? (
              <Link key={`${item.href}-${item.label}`} href={item.href} underline="hover">
                {item.label}
              </Link>
            ) : (
              <Typography key={item.label} color="text.primary" aria-current="page">
                {item.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h1">
            {title}
          </Typography>
          {description ? <Typography color="text.secondary">{description}</Typography> : null}
        </Stack>
        {actions}
      </Stack>
    </Stack>
  );
}
