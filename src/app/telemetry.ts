import { createReporter } from '@lib/frontend-telemetry';
import { setRouterErrorReporter } from './router';
import { session } from './session';

export const reportFrontendError = createReporter({
  enabled: () => ['authenticated', 'restricted'].includes(session.getSnapshot().status),
  endpoint: `${session.client.baseUrl}/telemetry/frontend`,
  release: typeof __GRD_RELEASE__ === 'undefined' ? 'development' : __GRD_RELEASE__,
  page: () => window.location.pathname,
});

export function installFrontendTelemetry() {
  setRouterErrorReporter((error) => reportFrontendError('react', error));
  session.client.onRequestError = (error, details) => reportFrontendError('api', error, details);
  window.addEventListener('error', (event) => reportFrontendError('browser', event.error));
  window.addEventListener('unhandledrejection', (event) =>
    reportFrontendError('unhandled-rejection', event.reason),
  );
}
