import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

type NotificationRequest = {
  message: string;
  severity?: NotificationSeverity;
};

type QueuedNotification = Required<NotificationRequest> & { id: number };

type NotificationContextValue = {
  showNotification: (request: NotificationRequest) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const nextId = useRef(1);
  const current = queue[0];

  const showNotification = useCallback(({ message, severity = 'info' }: NotificationRequest) => {
    const id = nextId.current;
    nextId.current += 1;
    setQueue((notifications) => [...notifications, { id, message, severity }].slice(-3));
  }, []);

  const value = useMemo(() => ({ showNotification }), [showNotification]);

  const closeCurrent = (_event?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setQueue((notifications) => notifications.slice(1));
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.id}
        open={Boolean(current)}
        autoHideDuration={4_500}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        onClose={closeCurrent}
      >
        {current ? (
          <Alert
            severity={current.severity}
            variant="filled"
            onClose={closeCurrent}
            sx={{ width: '100%' }}
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used within NotificationProvider.');
  return value;
}
