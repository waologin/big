/**
 * 通知許可を取得して、Web Push の購読情報（subscription）を返す関数。
 * Service Worker が登録されていない場合は自動登録も行う。
 * 
 * @returns {Promise<PushSubscription|null>} WebPush購読情報オブジェクト
 */
export async function getPushSubscription() {
  const VAPID_PUBLIC_KEY = "BGWYAYFk7U10CUO_gFbRh3-L-eKTZM0ZeKoWRpCouRpG5lWHxFfZRcJWBZ_AXrIqJZitKXR8ScTUriSRxgIu8ig"; // 🔐 ←後で設定（下記参照）
  const SW_PATH = "/sw.js"; // Service Worker のファイルパス

  try {
    // === 1️⃣ 通知許可をリクエスト ===
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("❌ 通知が許可されませんでした。");
      return null;
    }

    // === 2️⃣ Service Worker 登録 ===
    const registration = await navigator.serviceWorker.register(SW_PATH);
    console.log("✅ Service Worker 登録:", registration.scope);

    // === 3️⃣ PushManager から購読情報を取得 or 新規作成 ===
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("📦 既存購読を利用:", existingSub.endpoint);
      return existingSub.toJSON();
    }

    // Base64URL → Uint8Array 変換
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    const newSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log("✅ 新規購読成功:", newSub.endpoint);
    return newSub.toJSON();

  } catch (err) {
    console.error("getPushSubscription error:", err);
    return null;
  }
}

/**
 * Base64URL → Uint8Array 変換ユーティリティ
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
