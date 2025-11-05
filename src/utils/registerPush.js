// src/utils/registerPush.js

/**
 * 通知許可をリクエストして、Push 購読情報(subscription)を返す
 * VAPID 公開鍵はファイル内に固定で埋め込む（base64url 形式）
 *
 * @param {Object} [opts]
 * @param {string} [opts.serviceWorkerPath='/sw.js'] - Service Worker のパス
 * @returns {Promise<Object>} subscription.toJSON() の結果
 *
 * 使い方:
 *   const sub = await requestPushSubscription();
 */
export async function requestPushSubscription(opts = {}) {
  const serviceWorkerPath = opts.serviceWorkerPath || '/sw.js';

  // --- ここに VAPID 公開鍵（base64url形式）を埋め込む ---
  // 例: 'BM9...XyZ' のような形式（+ → -, / → _, パディングなし）
  const VAPID_PUBLIC_KEY_BASE64URL = 'ここにあなたのVAPID公開鍵を貼ってください';

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('このブラウザは Service Worker / Push をサポートしていません');
  }

  // 1) Service Worker 登録（既に登録済みなら既存登録を使う）
  const registration = await navigator.serviceWorker.register(serviceWorkerPath);

  // 2) 通知権限をリクエスト
  const current = Notification.permission;
  if (current === 'denied') {
    throw new Error('通知がブラウザ設定で拒否されています（permission = denied）');
  }
  if (current !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('通知が許可されませんでした');
    }
  }

  // 3) 既存の subscription を取得（あればそれを返す）
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY_BASE64URL);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  // 4) JSON 化して返す（送信先サーバに渡すため）
  return subscription.toJSON();
}

/** helper: base64url -> Uint8Array (VAPID 用) */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
