/**
 * 安全なPush送信関数
 * @param {Object} params - メッセージ内容 (例: { senderId, recipientId, message })
 * @param {Object} subscription - WebPush購読情報 (endpoint, keys)
 * @returns {Promise<Response>} サーバからのレスポンス
 */
export async function secureSendPush(params, subscription) {
  const API_URL = "https://tyuukanser.onrender.com/sendPush";

  // 🔐 サーバのRSA公開鍵（PEM形式）を直接埋め込み
  const SERVER_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0/1Q6CYRhR6E+QRf/5CW
vw9lvOMueA+UnD8APePVoGlIvpb8goVX/jXrpmNOMVI3QA13yrLiZ/FKCcCJ5b12
kpcId6BN9hO0ZO8ykGuKlmI74L/XQZ19NSGFIq847iN8sh3R5P36/eObhcfZRZqS
pyth7EroHnP1EG7Wgd8MRSmbbOv1Z7cRnlrPRhDxc8vbGFFRifEHtouy8LlmcdNm
Nvh6BGvbFRd2LBG87uNT+3uqgMUzweeLzrQhnphXkgoFH/Ayl4s2Z9dyy7DEGKTY
A7PSDAt0nzggY2iuKsGcabDbrHHkTpxd1MsIGRTS/xJjZobHKR5XCguXZjRn6SVh
7wIDAQAB
-----END PUBLIC KEY-----`;

  try {
    // === 1️⃣ AES-GCM 鍵生成 ===
    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // === 2️⃣ WebPush購読情報をAES暗号化 ===
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedAuth = encoder.encode(JSON.stringify(subscription));

    const encryptedAuthBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedAuth
    );
    const encryptedAuth = btoa(String.fromCharCode(...new Uint8Array(encryptedAuthBuffer)));

    // === 3️⃣ AES鍵をRSA-OAEPで暗号化 ===
    const publicKey = await importRSAPublicKey(SERVER_PUBLIC_PEM);
    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

    const wrappedKeyBuffer = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawAesKey
    );
    const wrappedKey = btoa(String.fromCharCode(...new Uint8Array(wrappedKeyBuffer)));

    // === 4️⃣ JSON送信データ構築 ===
    const payload = {
      ...params,
      encAuth: encryptedAuth,
      iv: btoa(String.fromCharCode(...iv)),
      wrappedKey,
      clientTimestamp: new Date().toISOString(),
    };

    // === 5️⃣ POST送信 ===
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
