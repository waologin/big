self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  console.log("📩 Push received:", data);

  event.waitUntil(
    self.registration.showNotification("受信メッセージ", {
      body: `${data.senderId || "誰か"}: ${data.message}`,
      icon: "icon-192.png",
      data
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});
