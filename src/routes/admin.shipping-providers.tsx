import { ProviderSettingsPage } from '@features/shipping-quotes';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/admin/shipping-providers')({
  component: ProviderSettingsPage,
});
