import { PageHeader } from '@components/layout/page-header';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Paper from '@mui/material/Paper';

export function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Operational shipment monitoring at a glance." />
      <Paper variant="outlined" sx={{ maxWidth: 760, p: { xs: 2, sm: 3 } }}>
        <Alert icon={<InfoOutlinedIcon />} severity="info" variant="outlined">
          <AlertTitle>Dashboard data is not connected yet</AlertTitle>
          Shipment totals and attention items will appear here when the overview feature is
          implemented. No shipment data is being inferred or fabricated.
        </Alert>
      </Paper>
    </>
  );
}
