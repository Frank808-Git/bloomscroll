import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Chrome blocks getUserMedia in extension popups. Detect the popup context
// (popups are narrow windows) and reopen as a full tab where camera works.
// The ?tab=1 param prevents the tab from re-triggering this redirect.
const params = new URLSearchParams(window.location.search);
const isTab = params.has('tab');

if (
  !isTab &&
  typeof chrome !== 'undefined' &&
  chrome.tabs &&
  window.outerWidth < 800
) {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html') + '?tab=1',
  });
  window.close();
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
