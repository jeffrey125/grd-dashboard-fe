import { QuoteDetailPage } from '@features/shipping-quotes';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/quotes/$comparisonId')({ component: QuoteDetailPage });
