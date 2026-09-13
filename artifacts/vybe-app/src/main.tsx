import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const legacyProductionHost = 'zyvio.replit.app';
const canonicalProductionHost = 'zyvios.site';

if (window.location.hostname === legacyProductionHost) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.protocol = 'https:';
  canonicalUrl.host = canonicalProductionHost;
  window.location.replace(canonicalUrl.toString());
} else {
  createRoot(document.getElementById('root')!, {
    // Keeps caught errors off reportError(), which would raise the dev overlay.
    onCaughtError: (error, errorInfo) => {
      console.error(error, errorInfo.componentStack);
    },
  }).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
