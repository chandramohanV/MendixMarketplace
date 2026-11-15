import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AppProviders } from './store/AppProviders';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('index.html is missing the #root element');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
