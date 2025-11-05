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


// src/main.js (or main app file)
import { listenToSWMessages, onPush } from './push/handler.js';
import { decryptEncForA, importKChatFromBase64Url } from './crypto/handler.js';
import { importPrivateKeyPkcs8Base64Url } from './crypto/rsa.js';
import { importAesRaw } from './crypto/aes.js';

// ---- helper: load A's private key from storage ----
// This depends on how you store the private key. Two options:
//  - You exported private key (pkcs8 base64url) and stored in localStorage (less secure).
//  - You stored private CryptoKey in IndexedDB (preferred).
// For demo, assume we stored pkcs8 base64url in localStorage under 'priv_pkcs8_b64u'
async function loadPrivateKeyFromLocalStorage() {
  const pkcs8Base64Url = localStorage.getItem('priv_pkcs8_b64u');
  if (!pkcs8Base64Url) {
    throw new Error('no private key in localStorage');
  }
  return await importPrivateKeyPkcs8Base64Url(pkcs8Base64Url);
}

// init SW listener
listenToSWMessages();

onPush(async (payload) => {
  try {
    console.log('[app] received push payload', payload);
    // if this payload is A-targeted encrypted handshake
    if (payload.type === 'K_SHARE_PUSH' && payload.wrappedKeyForA) {
      const privKey = await loadPrivateKeyFromLocalStorage();
      const obj = await decryptEncForA(payload, privKey);
      // obj should contain { k_chat: "<base64url>", authB: { endpoint, keys: {p256dh,auth} } }
      console.log('[app] decrypted handshake for A:', obj);

      // store k_chat and authB in localStorage / idb
      localStorage.setItem('k_chat_b64u', obj.k_chat);
      localStorage.setItem('authB', JSON.stringify(obj.authB));

      // optionally import k_chat as CryptoKey for immediate use
      const kChatKey = await importKChatFromBase64Url(obj.k_chat);
      // save CryptoKey to IndexedDB via keyStore (not implemented here)
      // keyStore.storeCryptoKey('k_chat', kChatKey);

      // send handshake_ack (via /sendPush) - implement sendPush wrapper to do this
      // sendHandshakeAckToB();

      return;
    }

    // other payloads: handle message payloads similarly by decrypting with stored k_chat
    // ...
  } catch (err) {
    console.error('[app] decrypt failed', err);
  }
});
