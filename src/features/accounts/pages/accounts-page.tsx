import { ApiError, safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { listAccounts } from '@features/accounts/api';
import { type Account, useSession } from '@features/auth';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';

export function accountListSearch(raw: Record<string, unknown>) {
  return {
    q: z
      .string()
      .max(254)
      .catch('')
      .parse(raw.q ?? ''),
    page: z.coerce
      .number()
      .int()
      .positive()
      .max(1_000_000)
      .catch(1)
      .parse(raw.page ?? 1),
    pageSize: z.coerce
      .number()
      .pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
      .catch(25)
      .parse(raw.pageSize ?? 25),
  };
}
const columns: GridColDef<Account>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 180,
    sortable: false,
    renderCell: ({ row }) => (
      <Link
        to="/admin/accounts/$accountId"
        params={{ accountId: row.externalId }}
        style={{ color: 'inherit' }}
      >
        {row.firstName} {row.lastName}
      </Link>
    ),
  },
  { field: 'email', headerName: 'Email', flex: 1.5, minWidth: 240, sortable: false },
  {
    field: 'role',
    headerName: 'Role',
    width: 100,
    sortable: false,
    valueFormatter: (value) => (value === 'admin' ? 'Admin' : 'Staff'),
  },
  {
    field: 'active',
    headerName: 'Status',
    width: 110,
    sortable: false,
    renderCell: ({ row }) => (
      <Chip
        size="small"
        variant="outlined"
        color={row.active ? 'success' : 'default'}
        label={row.active ? 'Active' : 'Inactive'}
      />
    ),
  },
  {
    field: 'mustChangePassword',
    headerName: 'Password replacement',
    width: 190,
    sortable: false,
    valueFormatter: (value) => (value ? 'Required' : 'Not required'),
  },
];
export function AccountsPage() {
  const { session, status, account } = useSession();
  const search = useSearch({ from: '/admin/accounts/' });
  const navigate = useNavigate({ from: '/admin/accounts/' });
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const query = useQuery({
    queryKey: ['accounts', 'list'],
    queryFn: ({ signal }) => listAccounts(session.client, signal),
    enabled: status === 'authenticated' && account?.role === 'admin',
    retry: false,
    staleTime: 0,
  });
  const inaccessible = query.error instanceof ApiError && [401, 403].includes(query.error.status);
  const data = inaccessible ? undefined : query.data;
  const term = search.q.trim().toLowerCase();
  const rows = (data ?? [])
    .filter((row) => `${row.firstName} ${row.lastName} ${row.email}`.toLowerCase().includes(term))
    .sort((a, b) =>
      `${a.lastName} ${a.firstName} ${a.email}`.localeCompare(
        `${b.lastName} ${b.firstName} ${b.email}`,
      ),
    );
  const page = Math.min(search.page, Math.max(1, Math.ceil(rows.length / search.pageSize)));
  useEffect(() => {
    if (data && page !== search.page)
      void navigate({ search: { ...search, page }, replace: true, resetScroll: false });
  }, [data, navigate, page, search]);
  const paginate = (next: number, pageSize = search.pageSize) =>
    void navigate({ search: { ...search, page: next, pageSize }, resetScroll: false });
  return (
    <Stack spacing={2}>
      <PageHeader
        title="Accounts"
        description="Manage employee access. Only Admins can access these pages."
        actions={
          <Button component={Link} to="/admin/accounts/new" variant="contained">
            Create account
          </Button>
        }
      />
      <TextField
        label="Search accounts"
        value={search.q}
        onChange={(event) =>
          void navigate({
            search: { ...search, q: event.target.value, page: 1 },
            replace: true,
            resetScroll: false,
          })
        }
        helperText="Search names and email across the loaded account list."
        fullWidth
      />
      {query.isPending && <CircularProgress aria-label="Loading accounts" />}
      {query.error && (
        <Alert
          severity={data ? 'warning' : 'error'}
          action={
            <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        >
          {data ? 'Account refresh failed. Displaying the last loaded list. ' : ''}
          {safeError(query.error).message}
        </Alert>
      )}
      {data &&
        (mobile ? (
          <Stack spacing={2} aria-label="Account cards">
            {!rows.length && <Typography>No accounts match your search.</Typography>}
            {rows.slice((page - 1) * search.pageSize, page * search.pageSize).map((row) => (
              <Card
                key={row.externalId}
                component="article"
                variant="outlined"
                sx={{ overflowWrap: 'anywhere' }}
              >
                <CardContent>
                  <Typography component="h2" variant="h6">
                    <Link
                      to="/admin/accounts/$accountId"
                      params={{ accountId: row.externalId }}
                      style={{ color: 'inherit' }}
                    >
                      {row.firstName} {row.lastName}
                    </Link>
                  </Typography>
                  <Typography>{row.email}</Typography>
                  <Typography>
                    {row.role === 'admin' ? 'Admin' : 'Staff'} ·{' '}
                    {row.active ? 'Active' : 'Inactive'}
                  </Typography>
                  <Typography>
                    Password replacement: {row.mustChangePassword ? 'Required' : 'Not required'}
                  </Typography>
                </CardContent>
              </Card>
            ))}
            <TablePagination
              component="div"
              count={rows.length}
              page={page - 1}
              rowsPerPage={search.pageSize}
              rowsPerPageOptions={[25, 50, 100]}
              onPageChange={(_event, value) => paginate(value + 1)}
              onRowsPerPageChange={(event) =>
                paginate(1, Number(event.target.value) as 25 | 50 | 100)
              }
              sx={{
                '& .MuiTablePagination-toolbar': {
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  px: 0,
                },
              }}
            />
          </Stack>
        ) : (
          <Box sx={{ height: 600, width: '100%', minWidth: 0 }}>
            <DataGrid
              aria-label="Accounts"
              rows={rows}
              columns={columns}
              getRowId={(row) => row.externalId}
              loading={query.isFetching}
              disableColumnFilter
              disableColumnMenu
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100]}
              paginationModel={{ page: page - 1, pageSize: search.pageSize }}
              onPaginationModelChange={(model) => {
                if (model.page !== page - 1 || model.pageSize !== search.pageSize)
                  paginate(
                    model.pageSize === search.pageSize ? model.page + 1 : 1,
                    model.pageSize as 25 | 50 | 100,
                  );
              }}
              localeText={{ noRowsLabel: 'No accounts match your search.' }}
              sx={{ bgcolor: 'background.paper' }}
            />
          </Box>
        ))}
    </Stack>
  );
}
