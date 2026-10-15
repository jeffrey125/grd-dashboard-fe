import { render, screen } from '@testing-library/react';
import { GrdThemeProvider } from '@theme/theme-provider';
import { expect, it } from 'vitest';

import { PageHeader } from './page-header';

it('renders linked ancestors and the current page in a breadcrumb trail', () => {
  render(
    <GrdThemeProvider>
      <PageHeader
        title="Create shipments"
        breadcrumbs={[
          { label: 'Overview', href: '/' },
          { label: 'Shipments', href: '/shipments' },
          { label: 'Create shipments' },
        ]}
      />
    </GrdThemeProvider>,
  );

  expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Shipments' })).toHaveAttribute('href', '/shipments');
  expect(screen.getByText('Create shipments', { selector: '[aria-current="page"]' })).toBeVisible();
});
