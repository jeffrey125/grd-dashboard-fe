import { type ApiClient, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { type AmazonVerification, type AmazonVerificationAction, amazonVerification } from './api';

export function AmazonVerificationDialog({
  client,
  comparisonId,
  attemptId,
  onClose,
  onVerified,
}: {
  client: ApiClient;
  comparisonId: string;
  attemptId: string;
  onClose: () => void;
  onVerified: () => Promise<void>;
}) {
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const id = useRef<string | undefined>(undefined);
  const retried = useRef(false);
  const disposed = useRef(false);
  const [answer, setAnswer] = useState('');
  const [retryError, setRetryError] = useState<string | null>(null);
  const key = ['amazon-verification', comparisonId, attemptId];
  const action = useMutation({
    gcTime: 0,
    mutationFn: (input: AmazonVerificationAction) =>
      amazonVerification(client, comparisonId, attemptId, {
        operation: 'action',
        id: id.current ?? '',
        action: input,
      }),
    onMutate: async () => {
      await queries.cancelQueries({ queryKey: key });
    },
    onSuccess: (view) => {
      setAnswer('');
      queries.setQueryData(key, view);
    },
    onError: (error) => {
      showNotification({ message: safeError(error).message, severity: 'error' });
    },
    retry: false,
  });
  const query = useQuery<AmazonVerification>({
    queryKey: key,
    gcTime: 0,
    retry: false,
    enabled: !action.isPending && !action.error && !retried.current,
    refetchOnWindowFocus: false,
    refetchInterval: (current) =>
      current.state.error || current.state.data?.state === 'verified' ? false : 1500,
    queryFn: async ({ signal }) => {
      const view = await amazonVerification(
        client,
        comparisonId,
        attemptId,
        id.current ? { operation: 'poll', id: id.current } : { operation: 'start' },
        signal,
      );
      id.current = view.id;
      return view;
    },
  });
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      if (id.current)
        void amazonVerification(client, comparisonId, attemptId, {
          operation: 'cancel',
          id: id.current,
        }).catch(() => undefined);
    };
  }, [client, comparisonId, attemptId]);
  useEffect(() => {
    if (query.data?.state !== 'verified' || retried.current) return;
    retried.current = true;
    void onVerified()
      .then(() => {
        if (!disposed.current)
          showNotification({
            message: 'Amazon verified. The quote is being retried.',
            severity: 'success',
          });
      })
      .catch((error: unknown) => {
        if (!disposed.current)
          setRetryError(
            `Amazon is verified, but retry did not complete. ${safeError(error).message}`,
          );
      });
  }, [query.data?.state, onVerified, showNotification]);
  const view = query.data;
  const error =
    retryError ??
    (action.error
      ? safeError(action.error).message
      : query.error
        ? safeError(query.error).message
        : null);
  const frame = view?.frame;
  const disabled =
    action.isPending || query.isFetching || !!error || !frame || view?.state !== 'challenge';
  const sendKey = (value: 'Enter' | 'Backspace' | 'ArrowLeft' | 'ArrowRight') => {
    if (!disabled && frame) action.mutate({ type: 'key', key: value, frame });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="amazon-verification-title"
    >
      <DialogTitle id="amazon-verification-title">Verify Amazon & retry</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>
            Solve Amazon’s challenge below. After verification, we’ll retry this quote
            automatically.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Only you can control this window. It closes after 10 minutes. If Amazon asks for a code,
            use the authorized phone or email.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {view?.state === 'verified' ? (
            <Alert severity="success">Amazon verified. Retrying your quote…</Alert>
          ) : null}
          {(!view || view.state === 'preparing') && !error && (
            <Stack direction="row" spacing={1}>
              <CircularProgress size={20} />
              <Typography>Opening Amazon verification…</Typography>
            </Stack>
          )}
          {view?.state === 'challenge' && view.image && !error && (
            <>
              <Box
                component="button"
                type="button"
                aria-label="Amazon verification challenge"
                disabled={disabled}
                onKeyDown={(event) => {
                  if (['Enter', 'Backspace', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                    event.preventDefault();
                    sendKey(event.key as 'Enter' | 'Backspace' | 'ArrowLeft' | 'ArrowRight');
                  }
                }}
                onClick={(event) => {
                  if (disabled || !frame) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  action.mutate({
                    type: 'click',
                    frame,
                    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
                    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
                  });
                }}
                sx={{
                  p: 0,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'white',
                  width: '100%',
                  cursor: disabled ? 'wait' : 'pointer',
                  lineHeight: 0,
                }}
              >
                <Box
                  component="img"
                  src={`data:image/png;base64,${view.image}`}
                  alt="Amazon’s current verification challenge"
                  sx={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </Box>
              <Typography variant="body2">
                Click the controls in the image. For a text answer, first click its input in the
                image, then enter the answer below.
              </Typography>
              <TextField
                label="Challenge answer or verification code"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                autoComplete="off"
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button
                  disabled={disabled || !answer}
                  onClick={() => frame && action.mutate({ type: 'text', text: answer, frame })}
                >
                  Send answer
                </Button>
                <Button disabled={disabled} onClick={() => sendKey('Enter')}>
                  Enter
                </Button>
                <Button disabled={disabled} onClick={() => sendKey('Backspace')}>
                  Backspace
                </Button>
                <Button disabled={disabled} onClick={() => sendKey('ArrowLeft')}>
                  Left
                </Button>
                <Button disabled={disabled} onClick={() => sendKey('ArrowRight')}>
                  Right
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close verification</Button>
      </DialogActions>
    </Dialog>
  );
}
