import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@app/config';
import { AppProviders } from '@app/providers';

import './styles.css';
import { installFrontendTelemetry, reportFrontendError } from '@app/telemetry';

installFrontendTelemetry();

const root = document.getElementById('root');

if (!root) {
  throw new Error('The application root element is missing.');
}

createRoot(root, {
  onUncaughtError: (error) => reportFrontendError('react', error),
  onCaughtError: (error) => reportFrontendError('react', error),
}).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
