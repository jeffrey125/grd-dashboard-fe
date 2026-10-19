import { Decimal } from 'decimal.js';

export const QuoteDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
