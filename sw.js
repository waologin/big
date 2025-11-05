self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const title = `📩 ${data.senderId || '誰か'} からのメッセージ`;
  const options = {
    body: data.message || '新しいメッセージがあります',
    data,
    icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./index.html')
  );
});
