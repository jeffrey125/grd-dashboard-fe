import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@app/config';
import { AppProviders } from '@app/providers';

import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('The application root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
