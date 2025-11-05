// src/push/subscription.js
export async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知が拒否されました');
  return permission;
}

export async function getPushSubscription() {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env?.VAPID_PUBLIC_KEY || '<ここにVAPID公開鍵>'),
  });
  localStorage.setItem('subscription', JSON.stringify(subscription));
  return subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
