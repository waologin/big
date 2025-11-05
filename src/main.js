// src/main.js (or at top-level entry)
import { listenToSWMessages, onPush, onControl, requestFetchFromSW } from './push/handler.js';

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[main] SW registered:', reg.scope);
      // ensure controller active
      if (!navigator.serviceWorker.controller) {
        // when a page loads first time, controller may be null until reload
        console.log('[main] no SW controller yet; call navigator.serviceWorker.ready to wait');
      }
      return reg;
    } catch (err) {
      console.error('[main] SW register failed', err);
      throw err;
    }
  }
  throw new Error('Service Worker unsupported');
}

async function init() {
  try {
    await registerServiceWorker();
    // start listening to SW messages
    listenToSWMessages();

    // register push handlers
    onPush(async (payload) => {
      console.log('[main] push payload received (forwarded by SW)', payload);
      // Example handling strategy:
      // 1) If payload contains fetchUrl, request SW to fetch full payload (or do it from page)
      // 2) If payload contains encForA (encrypted for this device), call decryptPayload(payload)
      // 3) Save to IndexedDB and update UI
      if (payload.fetchUrl) {
        requestFetchFromSW(payload.fetchUrl, payload.fetchId || null);
      } else {
        // Implement decryptPayload() in crypto layer and call it here
        // const plain = await decryptPayload(payload);
        // saveMessage(plain)
      }
    });

    onControl((msg) => {
      console.log('[main] control message', msg);
      if (msg.type === 'subscriptionChange') {
        // re-subscribe flow
        // show UI to request permission and re-subscribe
      }
    });

  } catch (err) {
    console.error('[main] init failed', err);
  }
}

init();

// Hook up your UI mode buttons as before (A/B)
document.getElementById('modeA').addEventListener('click', async () => {
  // request notification permission + subscribe should be performed here
  // then proceed to RSA key generation & QR display
});
document.getElementById('modeB').addEventListener('click', async () => {
  // QR reader UI -> after scan => request notification permission & subscribe
});
