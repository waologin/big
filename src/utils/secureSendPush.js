// src/utils/secureSendPush.js

/**
 * 安全なPush送信関数
 * @param {Object} params - メッセージ内容 (例: { senderId, recipientId, message })
 * @param {Object} subscription - WebPush購読情報 (endpoint, keys)
 * @returns {Promise<Response>} サーバからのレスポンス
 */
export async function secureSendPush(params, subscription) {
  const API_URL = "https://tyuukanser.onrender.com/sendPush";
  const PUBLIC_KEY_URL = "https://tyuukanser.onrender.com/publicKey"; // 公開鍵取得エンドポイント

  try {
    // === 1️⃣ 公開鍵の取得（キャッシュ優先） ===
    let serverPublicKey = localStorage.getItem("SERVER_PUBLIC_PEM");
    if (!serverPublicKey) {
      const res = await fetch(PUBLIC_KEY_URL);
      const data = await res.json();
      serverPublicKey = data.publicKey;
      localStorage.setItem("SERVER_PUBLIC_PEM", serverPublicKey);
    }

    // === 2️⃣ AES-GCM 鍵生成 ===
    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // === 3️⃣ WebPush購読情報をAES暗号化 ===
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedAuth = encoder.encode(JSON.stringify(subscription));

    const encryptedAuthBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedAuth
    );
    const encryptedAuth = btoa(String.fromCharCode(...new Uint8Array(encryptedAuthBuffer)));

    // === 4️⃣ AES鍵をRSA-OAEPで暗号化 ===
    const publicKey = await importRSAPublicKey(serverPublicKey);
    const wrappedKeyBuffer = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      await crypto.subtle.exportKey("raw", aesKey)
    );
    const wrappedKey = btoa(String.fromCharCode(...new Uint8Array(wrappedKeyBuffer)));

    // === 5️⃣ JSON送信データ構築 ===
    const payload = {
      ...params,
      encAuth: encryptedAuth,
      iv: btoa(String.fromCharCode(...iv)),
      wrappedKey,
      clientTimestamp: new Date().toISOString(),
    };

    // === 6️⃣ POST送信 ===
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response;

  } catch (err) {
    console.error("secureSendPush error:", err);
    throw err;
  }
}

/**
 * PEM形式のRSA公開鍵文字列をCryptoKeyに変換
 */
async function importRSAPublicKey(pem) {
  // PEM文字列をバイナリ化
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryDer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}
