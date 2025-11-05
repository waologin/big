// src/utils/cryptoUtils.js

// --- 🔧 Utility Base64 関数群 ---
export const toBase64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

export const fromBase64 = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

// --- 🔐 AES-GCM 暗号化 ---
/**
 * AES-GCMで暗号化
 * @param {CryptoKey} key - AES鍵
 * @param {string|Uint8Array} data - 暗号化したい文字列またはバイナリ
 * @returns {Promise<{iv: string, ciphertext: string}>}
 */
export async function aesEncrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded =
    typeof data === "string" ? new TextEncoder().encode(data) : data;

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(encrypted),
  };
}

// --- 🔓 AES-GCM 復号 ---
/**
 * AES-GCMで復号
 * @param {CryptoKey} key
 * @param {string} ciphertextBase64
 * @param {string} ivBase64
 * @returns {Promise<string>} 復号後の文字列
 */
export async function aesDecrypt(key, ciphertextBase64, ivBase64) {
  const ciphertext = fromBase64(ciphertextBase64);
  const iv = new Uint8Array(fromBase64(ivBase64));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// --- 🔐 RSA-OAEP 公開鍵暗号化 ---
/**
 * RSA-OAEP でデータ暗号化
 * @param {CryptoKey} publicKey - RSA公開鍵
 * @param {string|ArrayBuffer} data
 * @returns {Promise<string>} Base64暗号文
 */
export async function rsaEncrypt(publicKey, data) {
  const buf =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    buf
  );
  return toBase64(encrypted);
}

// --- 🔓 RSA-OAEP 秘密鍵復号 ---
/**
 * RSA-OAEP でデータ復号
 * @param {CryptoKey} privateKey
 * @param {string} ciphertextBase64
 * @returns {Promise<string>}
 */
export async function rsaDecrypt(privateKey, ciphertextBase64) {
  const buf = fromBase64(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    buf
  );
  return new TextDecoder().decode(decrypted);
}

// --- 🧩 PEM⇄CryptoKey 変換 ---
export async function importPublicKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = fromBase64(b64);
  return crypto.subtle.importKey(
    "spki",
    bin,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = fromBase64(b64);
  return crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}
