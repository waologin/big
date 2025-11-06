// /service-worker.js
// Service Worker: Pushイベントを受け取り、ページ（クライアント）に復号処理を委譲して応答を待つ。
// - ハンドシェイク (type="handshake") と 通常メッセージ (type="message") を扱います。

// -----------------------------
// Utility: base64 <-> ArrayBuffer
// -----------------------------
function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// -----------------------------
// push イベントハンドラ
// -----------------------------
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("[SW] push: no data");
    return;
  }
  let text;
  try {
    text = event.data.text();
  } catch (e) {
    console.error("[SW] push event.data.text() failed:", e);
    return;
  }

  let msg;
  try {
    msg = JSON.parse(text);
  } catch (e) {
    console.error("[SW] push payload not JSON:", e);
    return;
  }

  if (msg.type === "handshake") {
    event.waitUntil(handleHandshake(msg));
  } else if (msg.type === "message") {
    event.waitUntil(handleEncryptedMessage(msg));
  } else {
    // generic notification
    const title = msg.title || "通知";
    const body = msg.message || JSON.stringify(msg);
    event.waitUntil(self.registration.showNotification(title, { body }));
  }
});

// -----------------------------
// handshake 処理: ページに委譲（秘密鍵はページ側で管理）
// -----------------------------
async function handleHandshake(msg) {
  try {
    // メッセージを受け取ったら、全クライアントの中から最初に応答可能なウィンドウを探す
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    if (!allClients || allClients.length === 0) {
      // クライアントがない — 通知だけ出して終了
      await self.registration.showNotification("Handshake 受信（クライアント不在）", {
        body: `from: ${msg.from || "unknown"}`,
      });
      return;
    }

    const client = allClients[0]; // シンプルに最初のウィンドウに委譲

    // MessageChannel を利用して応答を待つ
    return new Promise((resolve) => {
      const mc = new MessageChannel();
      // タイムアウト（10秒）で切る（応答がなければ解決）
      const timeout = setTimeout(() => {
        mc.port1.onmessage = null;
        resolve();
      }, 10000);

      mc.port1.onmessage = (ev) => {
        clearTimeout(timeout);
        // ev.data expected: { ok: true, saved: true } など
        resolve();
      };

      // client に委譲
      client.postMessage({ cmd: "handleHandshake", payload: msg }, [mc.port2]);
    });
  } catch (err) {
    console.error("[SW] handleHandshake error:", err);
  }
}

// -----------------------------
// 暗号化メッセージ受信: ページに復号委譲して通知表示
// -----------------------------
async function handleEncryptedMessage(msg) {
  try {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    if (allClients && allClients.length > 0) {
      const client = allClients[0];
      return new Promise((resolve) => {
        const mc = new MessageChannel();
        const timeout = setTimeout(() => { mc.port1.onmessage = null; resolve(); }, 8000);
        mc.port1.onmessage = (ev) => {
          clearTimeout(timeout);
          // ev.data could contain decrypted payload
          const d = ev.data;
          if (d && d.ok && d.decrypted) {
            self.registration.showNotification("メッセージ受信", { body: d.decrypted.text || JSON.stringify(d.decrypted) });
          } else {
            // fallback: raw message
            self.registration.showNotification("Encrypted message", { body: JSON.stringify(msg) });
          }
          resolve();
        };
        client.postMessage({ cmd: "handleEncryptedMessage", payload: msg }, [mc.port2]);
      });
    } else {
      // no client, simply show raw notification
      await self.registration.showNotification("Encrypted message (no client)", { body: JSON.stringify(msg) });
    }
  } catch (err) {
    console.error("[SW] handleEncryptedMessage error:", err);
  }
}

// -----------------------------
// 通知クリック
// -----------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // フォアグラウンドがあればフォーカス、それ以外は新しいウィンドウを開く
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windows) => {
      for (let w of windows) {
        if (w.url && 'focus' in w) return w.focus();
      }
      return clients.openWindow('/');
    })
  );
});
