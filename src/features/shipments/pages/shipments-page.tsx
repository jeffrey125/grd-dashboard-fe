import { PageHeader } from '@components/layout/page-header';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Paper from '@mui/material/Paper';

export function ShipmentsPage() {
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Search, monitor, and manage tracked shipments."
        breadcrumbs={[{ label: 'Overview', href: '/' }, { label: 'Shipments' }]}
      />
      <Paper variant="outlined" sx={{ maxWidth: 760, p: { xs: 2, sm: 3 } }}>
        <Alert icon={<LocalShippingOutlinedIcon />} severity="info" variant="outlined">
          <AlertTitle>Shipment list is not implemented yet</AlertTitle>
          This temporary shell page contains no fixture or production shipment data. The paginated
          shipment list will replace it in FE-V1-006.
        </Alert>
      </Paper>
    </>
  );
}
