import { z } from 'zod';

const names = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
]);
const segments = new Set([
  'search',
  'api',
  'v1',
  'auth',
  'me',
  'sign-in',
  'sign-out',
  'change-password',
  'admin',
  'accounts',
  'password',
  'shipments',
  'carriers',
  'dashboard',
  'overview',
  'tracking',
  'history',
  'refresh',
  'notes',
  'monitoring',
  'sales-reps',
  'shipping-quotes',
  'quotes',
  'results',
  'features',
  'review',
  'tracking-review',
  'events',
  'source-data',
  'new',
  'edit',
]);
export function safeRoute(value: string) {
  const path = value.split(/[?#]/, 1)[0] ?? '/';
  return `/${path
    .split('/')
    .filter(Boolean)
    .slice(0, 10)
    .map((part) => (segments.has(part) ? part : ':id'))
    .join('/')}`;
}

export function safeFrames(error: unknown): string[] {
  if (!(error instanceof Error)) return [];
  return [
    ...(error.stack ?? '')
      .split('\n')
      .slice(1)
      .join('\n')
      .matchAll(/\/((?:assets\/)[A-Za-z0-9_.-]+\.js:\d{1,8}:\d{1,8})(?=[\s)]|$)/g),
  ]
    .slice(0, 8)
    .flatMap((match) => (match[1] ? [match[1]] : []));
}

type Details = { method?: string; route?: string; status?: number; failedRequestId?: string };
export function createReporter(options: {
  enabled: () => boolean;
  endpoint: string;
  release: string;
  page: () => string;
  send?: typeof fetch;
}) {
  let windowStart = 0;
  let count = 0;
  const seen = new Set<string>();
  return (
    kind: 'browser' | 'react' | 'unhandled-rejection' | 'api',
    error: unknown,
    details: Details = {},
  ) => {
    // Telemetry must never change application control flow, even for hostile Error getters.
    try {
      if (!options.enabled()) return;
      const now = Date.now();
      if (now - windowStart >= 60_000) {
        windowStart = now;
        count = 0;
        seen.clear();
      }
      if (count >= 10) return;
      const event = {
        kind,
        page: safeRoute(options.page()),
        release: options.release,
        errorName:
          kind === 'api'
            ? 'ApiError'
            : error instanceof Error && names.has(error.name)
              ? error.name
              : 'UnknownError',
        frames: safeFrames(error),
        ...(details.method &&
        /^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)$/.test(details.method.toUpperCase())
          ? { method: details.method.toUpperCase() }
          : {}),
        ...(details.route ? { route: safeRoute(details.route) } : {}),
        ...(details.status !== undefined ? { status: details.status } : {}),
        ...(z.uuid().safeParse(details.failedRequestId).success
          ? { failedRequestId: details.failedRequestId }
          : {}),
      };
      const key = JSON.stringify(event);
      if (seen.has(key)) return;
      seen.add(key);
      count++;
      // Separate transport: no retries, recursion, response bodies, persistent queue or user identifiers.
      void (options.send ?? fetch)(options.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: key,
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    } catch {
      /* Reporting is best effort. */
    }
  };
}
