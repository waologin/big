import { pemToArrayBuffer, arrayBufferToBase64Url } from "./cryptoHelpers.js";
import { RELAY_ORIGIN } from "../config/constants.js";

/**
 * 中継サーバーへ安全に暗号化リクエストを送る関数
 * @param {Object} params - 任意の送信データ（senderId, recipientId, messageなど）
 * @param {Object} authInfo - WebPushのsubscriptionなど
 * @param {Object} [options]
 * @param {number} [options.retries=2] - 失敗時の再試行回数
 * @param {boolean} [options.refreshKeyOnFail=true] - 公開鍵無効時に再取得するか
 * @returns {Promise<Response>} fetchのResponse
 */
export async function secureSendPush(params, authInfo, options = {}) {
  const { retries = 2, refreshKeyOnFail = true } = options;
  let relayPublicKeyPem = localStorage.getItem("relayPublicKey");

  // 内部関数：リレー鍵取得
  async function fetchRelayPublicKey(force = false) {
    if (!relayPublicKeyPem || force) {
      const res = await fetch(`${RELAY_ORIGIN}/publicKey`);
      if (!res.ok) throw new Error("Failed to fetch relay public key");
      const data = await res.json();
      relayPublicKeyPem = data.publicKeyPem;
      localStorage.setItem("relayPublicKey", relayPublicKeyPem);
    }
  }

  // 内部関数：暗号化処理 + リクエスト実行
  async function executeSend() {
    await fetchRelayPublicKey();

    const relayPublicKey = await crypto.subtle.importKey(
      "spki",
      pemToArrayBuffer(relayPublicKeyPem),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );

    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const authBytes = new TextEncoder().encode(JSON.stringify(authInfo));

    const encAuthBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, authBytes);
    const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);
    const wrappedKeyBuffer = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, relayPublicKey, aesKeyRaw);

    const payload = {
      ...params,
      encAuth: arrayBufferToBase64Url(encAuthBuffer),
      iv: arrayBufferToBase64Url(iv),
      wrappedKey: arrayBufferToBase64Url(wrappedKeyBuffer),
      clientTimestamp: new Date().toISOString(),
    };

    const resp = await fetch(`${RELAY_ORIGIN}/sendPush`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return resp;
  }

  // 実行処理（再試行含む）
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const resp = await executeSend();
      if (resp.ok) return resp;

      // 公開鍵エラー → 再取得して再試行
      if (resp.status === 401 && refreshKeyOnFail) {
        console.warn("[secureSendPush] invalid key, refreshing...");
        await fetchRelayPublicKey(true);
        attempt++;
        continue;
      }

      throw new Error(`Request failed: ${resp.status}`);
    } catch (err) {
      console.error(`[secureSendPush] Attempt ${attempt + 1} failed:`, err);
      if (attempt >= retries) throw err;
      attempt++;
    }
  }
}
