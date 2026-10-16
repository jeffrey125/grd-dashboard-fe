import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { z } from 'zod';

dayjs.extend(utc);
dayjs.extend(timezone);

const calendarDate = z.iso.date().refine((value) => !value.startsWith('0000'));

/** Calendar dates have no timezone. Validate before Day.js can normalize an impossible date. */
export function parseCalendarDate(value: string) {
  if (!calendarDate.safeParse(value).success) return dayjs('');
  // A leap-year base also preserves valid years below 100 without JavaScript's 1900 offset.
  return dayjs(`2000-${value.slice(5)}`).year(Number(value.slice(0, 4)));
}

export function businessTimestamp(value: string | null) {
  return value
    ? dayjs(value).tz('America/New_York').format('MMM D, YYYY, h:mm A')
    : 'Not available';
}
