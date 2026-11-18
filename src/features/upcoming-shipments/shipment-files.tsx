import { useSession } from '@features/auth';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';

const schema = z.object({
  files: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      size: z.number(),
      type: z.string(),
      url: z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.port &&
          url.hostname.endsWith('.airtableusercontent.com')
        );
      }),
    }),
  ),
});
type File = z.infer<typeof schema>['files'][number];

export function ShipmentFiles({ orderId }: { orderId: string }) {
  const { session, account } = useSession();
  const [preview, setPreview] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const query = useQuery({
    queryKey: ['upcoming-files', account?.externalId, orderId],
    queryFn: async ({ signal }) =>
      schema.parse(
        await session.client.request({
          url: `/upcoming-shipments/${orderId}/files`,
          signal,
        }),
      ),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const open = async (id: string, download: boolean) => {
    const tab = download ? window.open('about:blank', '_blank') : null;
    if (tab) tab.opener = null;
    setBusy(true);
    setFailed(false);
    try {
      const result = await query.refetch();
      if (result.error) throw result.error;
      const file = result.data?.files.find((item) => item.id === id);
      if (!file) throw new Error('File unavailable');
      if (download) {
        if (!tab) throw new Error('Popup blocked');
        tab.location.replace(file.url);
      } else setPreview(file);
    } catch {
      tab?.close();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box component="section" aria-label="Shipment files">
      <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
        Files
      </Typography>
      {query.isPending && (
        <Skeleton variant="rounded" height={80} aria-label="Loading shipment files" />
      )}
      {(query.isError || failed) && (
        <Alert
          severity="error"
          action={
            <Button
              onClick={() => {
                setFailed(false);
                void query.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          Files could not be opened. Try again; allow a new tab for downloads.
        </Alert>
      )}
      {!query.isError && query.data?.files.length === 0 && (
        <Typography color="text.secondary">No files attached to this shipment.</Typography>
      )}
      {!query.isError && (
        <Stack spacing={1}>
          {query.data?.files.map((file) => (
            <Box key={file.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                {file.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {file.type === 'application/pdf' ? 'PDF' : file.type} ·{' '}
                {Math.max(1, Math.round(file.size / 1024))} KB
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {(file.type === 'application/pdf' ||
                  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) && (
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() => void open(file.id, false)}
                  >
                    Preview
                  </Button>
                )}
                <Button variant="outlined" disabled={busy} onClick={() => void open(file.id, true)}>
                  Download
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ overflowWrap: 'anywhere' }}>{preview?.filename}</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button onClick={() => setPreview(null)}>Back to order</Button>
            <Button disabled={busy} onClick={() => preview && void open(preview.id, true)}>
              Download
            </Button>
          </Stack>
          {preview?.type === 'application/pdf' ? (
            <>
              <Typography variant="caption">
                If your browser cannot display the PDF, use Download.
              </Typography>
              <Box
                component="iframe"
                src={preview.url}
                title={preview.filename}
                referrerPolicy="no-referrer"
                sx={{ width: '100%', height: '65vh', border: 0 }}
              />
            </>
          ) : (
            preview && (
              <Box
                component="img"
                src={preview.url}
                alt={preview.filename}
                referrerPolicy="no-referrer"
                sx={{ display: 'block', maxWidth: '100%', mx: 'auto' }}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
