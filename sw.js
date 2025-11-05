// sw.js
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  const title = data.senderId ? `📩 ${data.senderId} からのメッセージ` : "新着メッセージ";
  const body = data.message || "内容なし";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
    })
  );
});
