export async function getPushSubscription() {
  const VAPID_PUBLIC_KEY = "BGWYAYFk7U10CUO_gFbRh3-L-eKTZM0ZeKoWRpCouRpG5lWHxFfZRcJWBZ_AXrIqJZitKXR8ScTUriSRxgIu8ig";
  const SW_PATH = "/sw.js";

  try {
    // HTTPS チェック
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      throw new Error("通知APIはHTTPSまたはlocalhostでのみ利用可能です。");
    }

    // 通知権限確認
    if (Notification.permission === "denied") {
      console.warn("⚠️ 通知がすでに拒否されています。ブラウザ設定から許可をリセットしてください。");
      return null;
    }

    // 通知許可リクエスト
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("❌ 通知が許可されませんでした。");
      return null;
    }

    // Service Worker 登録
    let registration;
    try {
      registration = await navigator.serviceWorker.register(SW_PATH);
      console.log("✅ Service Worker 登録:", registration.scope);
    } catch (e) {
      console.error("❌ Service Worker 登録失敗:", e);
      throw e;
    }

    // 既存購読確認
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("📦 既存購読を利用:", existingSub.endpoint);
      return existingSub.toJSON();
    }

    // 新規購読作成
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const newSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log("✅ 新規購読成功:", newSub.endpoint);
    return newSub.toJSON();

  } catch (err) {
    console.error("getPushSubscription error:", err.name, err.message);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
