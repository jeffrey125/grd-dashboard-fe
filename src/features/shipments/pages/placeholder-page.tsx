import { PageHeader } from '@components/layout/page-header';
import { listReturnTo } from '@features/shipments/search-state';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useSearch } from '@tanstack/react-router';

export function ShipmentPlaceholder({ detail = false }: { detail?: boolean }) {
  const search = useSearch({ strict: false });
  return (
    <Stack spacing={2}>
      <PageHeader title={detail ? 'Shipment details' : 'Add shipments'} />
      <Alert severity="info">
        {detail
          ? 'Shipment details are not available yet.'
          : 'Shipment creation is not available yet.'}
      </Alert>
      <Button href={listReturnTo(search.returnTo)} sx={{ alignSelf: 'flex-start' }}>
        Back to results
      </Button>
    </Stack>
  );
}
