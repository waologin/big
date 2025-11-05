// =======================================================
// service-worker.js
// Web Push通知を受信して表示するService Worker
// =======================================================

// Pushイベントを受け取ったとき
self.addEventListener("push", (event) => {
  console.log("[ServiceWorker] Push受信:", event);

  if (!event.data) {
    console.warn("[ServiceWorker] Pushにデータが含まれていません。");
    return;
  }

  try {
    const payload = event.data.json(); // JSON形式を想定
    console.log("[ServiceWorker] payload:", payload);

    const title = payload.senderId ? `📩 ${payload.senderId} からのメッセージ` : "新しい通知";
    const options = {
      body: payload.message || "内容なし",
      icon: "/icon.png", // 任意（なければ削除OK）
      badge: "/badge.png", // 任意
      data: payload, // クリック時に参照できる
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[ServiceWorker] Push処理中にエラー:", err);
  }
});

// 通知がクリックされたとき
self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] 通知クリック:", event.notification);
  event.notification.close();

  const payload = event.notification.data;
  const url = payload?.url || "/"; // クリック時に開くURL
  event.waitUntil(clients.openWindow(url));
});
