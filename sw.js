// sw.js - Service Worker (minimal + practical)
const SW_SCOPE = '/';
const FETCH_TIMEOUT_MS = 8000;

self.addEventListener('install', (evt) => {
  // skipWaiting() を必要なら有効化（慎重に）
  // self.skipWaiting();
  console.log('[sw] install');
});

self.addEventListener('activate', (evt) => {
  console.log('[sw] activate');
  // clients.claim(); // 必要なら
});

// Helper: broadcast to all controlled clients (pages)
async function broadcast(message) {
  const all = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const c of all) {
    c.postMessage(message);
  }
}

// Helper: basic fetch with timeout
async function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Main push handler
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    // not json or empty
    payload = {};
  }

  event.waitUntil(handlePush(payload));
});

async function handlePush(payload) {
  try {
    // If payload indicates full data must be fetched:
    if (payload.fetchUrl) {
      try {
        const res = await fetchWithTimeout(payload.fetchUrl, { credentials: 'same-origin' });
        if (res.ok) {
          const full = await res.json();
          payload = { ...payload, ...full };
        } else {
          console.warn('[sw] fetchUrl returned non-ok', res.status);
        }
      } catch (err) {
        console.warn('[sw] fetchUrl failed', err);
        // continue with minimal payload
      }
    }

    const type = payload.type || 'MSG_PUSH';

    // If the worker has local keys and is willing to decrypt, try it (optional)
    // Implement swCanDecrypt(payload) & swDecryptPayload(payload) if you want SW-side decrypt.
    const canDecryptInSW = false; // default: false (change after implementing)
    if (canDecryptInSW && (type === 'MSG_PUSH' || type === 'K_SHARE_PUSH')) {
      try {
        // Attempt to decrypt and store inside SW (implement swDecryptPayload)
        // const plain = await swDecryptPayload(payload);
        // await storeMessageToIdb(payload.sessionId, plain);
        // show notification if needed
        // return self.registration.showNotification(payload.title || 'SecureChat', { body: '新着メッセージがあります' });
      } catch (err) {
        console.warn('[sw] decrypt-in-sw failed, forwarding to client', err);
      }
    }

    // Forward to clients (page) so they can decrypt and store/display
    await broadcast({ kind: 'push', payload });

    // Show user-visible notification (generic or payload-driven)
    const title = (payload.notification && payload.notification.title) || payload.senderId || '新着メッセージ';
    const body = (payload.notification && payload.notification.body) || (payload.message ? (typeof payload.message === 'string' ? payload.message : 'メッセージを受信しました') : 'メッセージがあります');

    // If payload includes silent:true, avoid showing notification
    const silent = !!payload.silent;
    if (!silent) {
      const options = {
        body,
        tag: payload.tag || undefined,
        data: {
          payloadMeta: payload.meta || null,
          sessionId: payload.sessionId || null,
          url: payload.url || '/'
        },
        renotify: !!payload.renotify,
        silent: false
      };
      await self.registration.showNotification(title, options);
    }

  } catch (err) {
    console.error('[sw] handlePush error', err);
    // fallback generic notification
    try {
      await self.registration.showNotification('SecureChat', { body: 'メッセージ受信に失敗しました' });
    } catch (e) { /* ignore */ }
  }
}

// Notification click handler - focus or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of allClients) {
      // focus existing client
      if (c.url && 'focus' in c) {
        await c.focus();
        // send message to client to navigate to session if needed
        c.postMessage({ kind: 'notificationClick', data: event.notification.data });
        return;
      }
    }
    // open a new window if none
    await clients.openWindow(event.notification.data?.url || '/');
  })());
});

// Handle subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[sw] pushsubscriptionchange');
  event.waitUntil((async () => {
    try {
      const registration = await self.registration;
      // Typically you re-subscribe and inform server; we inform clients to handle re-subscribe
      await broadcast({ kind: 'subscriptionChange' });
    } catch (err) {
      console.warn('[sw] pushsubscriptionchange error', err);
    }
  })());
});

// Optional: message handler for client->SW messages (e.g., request to fetch offline payload)
self.addEventListener('message', (event) => {
  const { command, data } = event.data || {};
  if (command === 'fetchMessage' && data && data.fetchUrl) {
    event.waitUntil((async () => {
      try {
        const res = await fetchWithTimeout(data.fetchUrl, { credentials: 'same-origin' });
        if (res.ok) {
          const json = await res.json();
          // forward to client that requested
          const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
          for (const c of allClients) {
            c.postMessage({ kind: 'fetchedMessage', data: json, requestId: data.requestId });
          }
        } else {
          console.warn('[sw] fetchMessage non-ok', res.status);
        }
      } catch (err) {
        console.warn('[sw] fetchMessage failed', err);
      }
    })());
  }
});
