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
        '& .fc-daygrid-day-top': { flexDirection: 'row' },
        '& .fc-daygrid-day-number': { width: '100%', p: 0 },
        '& .fc-daygrid-event': {
          cursor: 'pointer',
          color: 'text.primary',
          bgcolor: 'action.hover',
          border: 0,
          p: 0.5,
          whiteSpace: 'normal',
        },
        '& .fc-daygrid-more-link': { color: 'primary.main' },
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
              }))
        }
        eventClick={({ event }) => {
          if (event.startStr) onDate(event.startStr);
        }}
        dateClick={({ dateStr }) => {
          if (dateStr >= from && dateStr <= through) onDate(dateStr);
        }}
        moreLinkClick={(info) => {
          onDate(parseCalendarDate(from).date(info.date.getDate()).format('YYYY-MM-DD'));
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
              sx={{ minWidth: 0, minHeight: 44 }}
            >
              {info.dayNumberText}
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
