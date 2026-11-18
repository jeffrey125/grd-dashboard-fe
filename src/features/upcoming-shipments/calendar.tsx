import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { parseCalendarDate } from '@lib/dates';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { UpcomingOrder } from './api';

export function ShipmentCalendar({
  from,
  through,
  orders,
  compact,
  selected,
  onDate,
}: {
  from: string;
  through: string;
  orders: UpcomingOrder[];
  compact: boolean;
  selected: string | null;
  onDate: (date: string) => void;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        '--fc-border-color': 'var(--grd-palette-divider)',
        '--fc-page-bg-color': 'var(--grd-palette-background-paper)',
        '--fc-neutral-bg-color': 'var(--grd-palette-action-hover)',
        '--fc-today-bg-color': 'transparent',
        '--fc-event-text-color': 'var(--grd-palette-text-primary)',
        '& .fc': { fontFamily: 'inherit', fontSize: compact ? 12 : 14 },
        '& .fc-scrollgrid': { borderRadius: 2, overflow: 'hidden' },
        '& .fc-col-header-cell': { bgcolor: 'action.hover', py: 1 },
        '& .fc-col-header-cell-cushion': { color: 'text.secondary', fontWeight: 600 },
        '& .fc-daygrid-day-frame': { minHeight: compact ? 52 : 96 },
        '& .fc-day-sat, & .fc-day-sun': { bgcolor: 'action.hover' },
        '& .fc-day-disabled': { bgcolor: 'action.disabledBackground' },
        '& .fc-daygrid-day-top': { flexDirection: 'row', px: compact ? 0 : 0.5 },
        '& .fc-daygrid-day-number': { width: '100%', p: 0 },
        '& .fc-daygrid-event': {
          cursor: 'pointer',
          color: 'text.primary',
          bgcolor: 'action.hover',
          border: 0,
          borderLeft: '3px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          mx: 0.75,
          mb: 0.5,
          px: 1,
          py: 1,
          fontSize: 12,
          lineHeight: 1.4,
          whiteSpace: 'normal',
          '&:hover': { bgcolor: 'action.selected' },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        },
        '& .fc-daygrid-more-link': {
          color: 'primary.main',
          fontWeight: 600,
          mx: 1,
          px: 0.5,
          py: 0.5,
        },
        '& .fc-daygrid-day-events': { display: compact ? 'none' : undefined },
      }}
    >
      <FullCalendar
        key={from.slice(0, 7)}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={from}
        now={from}
        headerToolbar={false}
        firstDay={1}
        fixedWeekCount={false}
        showNonCurrentDates={false}
        validRange={{
          start: parseCalendarDate(from).startOf('month').format('YYYY-MM-DD'),
          end: parseCalendarDate(through).add(1, 'day').format('YYYY-MM-DD'),
        }}
        height="auto"
        selectable={false}
        editable={false}
        dayMaxEvents={3}
        displayEventTime={false}
        events={
          compact
            ? []
            : orders.map((order) => ({
                id: order.id,
                title: order.customer,
                start: order.requestedShipOn,
                allDay: true,
                extendedProps: {
                  purchaseOrders: [
                    ...new Set(
                      order.lines
                        .map((line) => line.purchaseOrder)
                        .filter((po): po is string => po !== null && po !== ''),
                    ),
                  ],
                },
              }))
        }
        eventContent={({ event }) => (
          <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Typography
              component="div"
              sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main', lineHeight: 1.5 }}
            >
              {event.extendedProps.purchaseOrders.length
                ? `PO# ${event.extendedProps.purchaseOrders.join(', ')}`
                : 'PO# not assigned'}
            </Typography>
            <Typography
              component="div"
              sx={{ fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}
            >
              {event.title}
            </Typography>
          </Box>
        )}
        eventClick={({ event }) => {
          if (event.startStr) onDate(event.startStr);
        }}
        dateClick={({ dateStr }) => {
          if (dateStr >= from && dateStr <= through) onDate(dateStr);
        }}
        moreLinkClick={({ hiddenSegs }) => {
          // Each shipment is a single all-day event. Its ISO date is the clicked day in every zone.
          const date = hiddenSegs[0]?.event.startStr;
          if (date) onDate(date);
          return 'none';
        }}
        dayCellContent={(info) => {
          const date = `${info.date.getFullYear()}-${String(info.date.getMonth() + 1).padStart(2, '0')}-${String(info.date.getDate()).padStart(2, '0')}`;
          const count = orders.filter((order) => order.requestedShipOn === date).length;
          return (
            <Button
              fullWidth
              size="small"
              disabled={date < from || date > through}
              aria-label={`${date}, ${count} orders`}
              aria-pressed={compact ? date === selected : undefined}
              variant={compact && date === selected ? 'contained' : 'text'}
              onClick={(event) => {
                event.stopPropagation();
                onDate(date);
              }}
              sx={{
                minWidth: 0,
                minHeight: 44,
                justifyContent: compact ? 'center' : 'flex-start',
                px: compact ? 0.5 : 1,
                color: compact && date === selected ? undefined : 'text.primary',
                fontWeight: 600,
                '&.Mui-disabled': { color: 'text.disabled' },
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  ...(date === from && !(compact && date === selected)
                    ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                    : {}),
                }}
              >
                {info.dayNumberText}
              </Box>
              {compact && count > 0 ? ' ·' : ''}
            </Button>
          );
        }}
      />
    </Box>
  );
}

export function DateNavigator({
  from,
  through,
  orders,
  selected,
  onDate,
}: {
  from: string;
  through: string;
  orders: UpcomingOrder[];
  selected: string | null;
  onDate: (date: string | null) => void;
}) {
  const days = parseCalendarDate(through).diff(parseCalendarDate(from), 'day') + 1;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ overflowX: 'auto', pb: 1 }}
      aria-label="Shipment dates"
    >
      <Button
        variant={!selected ? 'contained' : 'outlined'}
        onClick={() => onDate(null)}
        sx={{ flexShrink: 0 }}
      >
        All dates
      </Button>
      {Array.from({ length: days }, (_, i) => parseCalendarDate(from).add(i, 'day')).map((day) => {
        const date = day.format('YYYY-MM-DD');
        const count = orders.filter((order) => order.requestedShipOn === date).length;
        return (
          <Button
            key={date}
            aria-pressed={selected === date}
            variant={selected === date ? 'contained' : 'outlined'}
            onClick={() => onDate(date)}
            sx={{ flexShrink: 0, minWidth: 72, display: 'block' }}
          >
            <Typography component="span" variant="caption" sx={{ display: 'block' }}>
              {day.format('ddd')}
            </Typography>
            {day.format('MMM D')}
            <Typography component="span" variant="caption" sx={{ display: 'block' }}>
              {count} orders
            </Typography>
          </Button>
        );
      })}
    </Stack>
  );
}
