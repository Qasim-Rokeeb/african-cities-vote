import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Suppress known Leather extension JSON parsing errors that cause annoying runtime overlays
const silenceExtensionErrors = (event) => {
  const msg = event.message || event.reason?.message || '';
  if (msg.includes('setImmedia') || msg.includes('Unexpected token') || msg.includes('JSON.parse')) {
    event.stopImmediatePropagation();
    if (event.preventDefault) event.preventDefault();
  }
};

window.addEventListener('error', silenceExtensionErrors);
window.addEventListener('unhandledrejection', silenceExtensionErrors);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
