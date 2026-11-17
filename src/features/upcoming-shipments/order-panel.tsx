import { parseCalendarDate } from '@lib/dates';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import Fade from '@mui/material/Fade';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import type { UpcomingOrder } from './api';

export function OrderList({
  orders,
  onOrder,
}: {
  orders: UpcomingOrder[];
  onOrder: (id: string) => void;
}) {
  return (
    <Stack spacing={1}>
      {!orders.length && (
        <Typography color="text.secondary">No upcoming shipments for this date.</Typography>
      )}
      {orders.map((order) => (
        <Button
          key={order.id}
          data-order-id={order.id}
          variant="outlined"
          onClick={() => onOrder(order.id)}
          sx={{
            display: 'block',
            textAlign: 'left',
            p: 1.5,
            borderColor: 'divider',
            overflowWrap: 'anywhere',
          }}
        >
          <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>
            {order.customer}
          </Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block' }}>
            {order.salesOrders.join(', ') || 'SO not assigned'} ·{' '}
            {parseCalendarDate(order.requestedShipOn).format('MMM D')}
          </Typography>
          <Typography component="span" variant="caption" color="text.secondary">
            {order.reps.join(', ') || 'Unassigned'} ·{' '}
            {order.lines[0]?.product || 'Product unavailable'}
          </Typography>
        </Button>
      ))}
    </Stack>
  );
}

function OrderDetails({ order }: { order: UpcomingOrder }) {
  return (
    <Stack spacing={2} sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="h6">{order.customer}</Typography>
      <Box component="dl" sx={{ m: 0 }}>
        {Object.entries({
          'Requested ship': parseCalendarDate(order.requestedShipOn).format('MMM D, YYYY'),
          'Sales order': order.salesOrders.join(', ') || 'Not assigned',
          'Sales reps': order.reps.join(', ') || 'Unassigned',
          'Customer PO': order.customerPo ?? 'Not provided',
          Tracking: order.tracking ?? 'Not provided',
          Pallets: order.pallets ?? 'Not provided',
        }).map(([label, value]) => (
          <Box key={label} sx={{ mb: 1.5 }}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" sx={{ m: 0 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      {order.lines.map((line) => (
        <Box key={line.lineNumber} sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
          <Typography sx={{ fontWeight: 650 }}>{line.product}</Typography>
          <Typography variant="body2">{line.vendor}</Typography>
          <Typography variant="body2">
            GRD PO: {line.purchaseOrder ?? 'Not assigned'}
            {line.purchaseOrder === '0' ? ' · Warehouse stock' : ''}
          </Typography>
          <Typography variant="body2">
            {line.pounds ?? '—'} lbs · {line.units ?? '—'} units
          </Typography>
          {line.origin && <Typography variant="body2">FOB: {line.origin}</Typography>}
        </Box>
      ))}
      {order.notes && (
        <Box>
          <Typography sx={{ fontWeight: 650 }}>Notes</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{order.notes}</Typography>
        </Box>
      )}
      <Button
        component="a"
        href={order.airtableUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="outlined"
      >
        Open in Airtable
      </Button>
    </Stack>
  );
}

export function OrderPanel({
  mobile,
  date,
  orderId,
  orders,
  onOrder,
  onClose,
  onBack,
}: {
  mobile: boolean;
  date: string | null;
  orderId: string | null;
  orders: UpcomingOrder[];
  onOrder: (id: string) => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const selectedOrder = useRef<string | null>(null);
  const order = orders.find((row) => row.id === orderId);
  const dayOrders = orders.filter((row) => row.requestedShipOn === date);
  const title = orderId
    ? 'Order details'
    : date
      ? parseCalendarDate(date).format('dddd, MMM D')
      : 'Upcoming shipments';
  const back = () => {
    onBack();
    requestAnimationFrame(() => {
      if (scroll.current) {
        scroll.current.scrollTop = savedScroll.current;
        scroll.current
          .querySelector<HTMLButtonElement>(`[data-order-id="${selectedOrder.current}"]`)
          ?.focus({ preventScroll: true });
      }
    });
  };
  const body = (
    <Fade key={orderId ?? date ?? 'empty'} in appear>
      <Stack spacing={2}>
        {orderId ? (
          order ? (
            <OrderDetails order={order} />
          ) : (
            <Typography>
              This order is no longer in the current view. Refresh to see the latest shipments.
            </Typography>
          )
        ) : (
          <>
            <Typography color="text.secondary">
              {dayOrders.length} orders · Select an order for details
            </Typography>
            <OrderList
              orders={dayOrders}
              onOrder={(id) => {
                savedScroll.current = scroll.current?.scrollTop ?? 0;
                selectedOrder.current = id;
                onOrder(id);
              }}
            />
          </>
        )}
      </Stack>
    </Fade>
  );
  if (mobile)
    return (
      <Dialog
        open={Boolean(orderId)}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        aria-labelledby="upcoming-order-title"
      >
        <DialogTitle id="upcoming-order-title">
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            {title}
            <Button onClick={onClose}>Close</Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>{body}</DialogContent>
      </Dialog>
    );
  return (
    <Drawer
      anchor="right"
      open={Boolean(date || orderId)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: 'min(480px, 95vw)' },
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'upcoming-order-title',
        },
      }}
    >
      <Stack direction="row" sx={{ p: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        {orderId && date && (
          <Button autoFocus onClick={back}>
            ← Back to orders
          </Button>
        )}
        <Typography id="upcoming-order-title" variant="h6">
          {title}
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </Stack>
      <Box ref={scroll} sx={{ overflowY: 'auto', p: 2 }}>
        {body}
      </Box>
    </Drawer>
  );
}
