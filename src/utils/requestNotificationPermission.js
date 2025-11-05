/**
 * Web Push 通知の許可と購読情報を取得する
 * @returns {Promise<Object>} Web Push Subscription 情報 (endpoint, keys)
 */
export async function requestNotificationPermission() {
  const VAPID_PUBLIC_KEY = "あなたのVAPID公開鍵をここに"; // ←サーバの /vapidPublicKey で取得したものを固定で埋め込む
  const serviceWorkerPath = "/service-worker.js"; // 必要に応じて変更

  try {
    // === 1️⃣ 通知許可状態を確認 ===
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("通知が許可されませんでした。");
    }

    // === 2️⃣ Service Worker 登録 ===
    let registration;
    try {
      registration = await navigator.serviceWorker.register(serviceWorkerPath);
      console.log("[SW] 登録完了:", registration);
    } catch (err) {
      throw new Error("Service Worker の登録に失敗しました。詳細: " + err.message);
    }

    // === 3️⃣ PushManager の購読確認 or 新規作成 ===
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      try {
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      } catch (err) {
        throw new Error("Push購読の作成に失敗しました。詳細: " + err.message);
      }
    }

    // === 4️⃣ JSON形式に整形して返す ===
    const subObj = subscription.toJSON();
    return subObj;

  } catch (err) {
    console.error("requestNotificationPermission error:", err);
    // 状況別メッセージを付けて再throw
    if (err.message.includes("Service Worker")) {
      throw new Error("Service Worker 登録エラー: " + err.message);
    } else if (err.message.includes("Push購読")) {
      throw new Error("Push購読エラー: " + err.message);
    } else if (err.message.includes("通知")) {
      throw new Error("通知許可エラー: " + err.message);
    } else {
      throw new Error("不明なエラー: " + err.message);
    }
  }
}

/**
 * VAPID 公開鍵を Uint8Array に変換 (Base64URL → Uint8)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
