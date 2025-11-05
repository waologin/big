// sw.js
self.addEventListener("push", e => {
  const data = e.data ? e.data.text() : "(no payload)";
  e.waitUntil(
    self.registration.showNotification("Push通知", {
      body: data,
      icon: "/icon.png"
    })
  );
});
