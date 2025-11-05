// src/utils/cryptoKeyGen.js

/**
 * ✅ AES-GCM 256bit 鍵をランダム生成
 * @returns {Promise<{ raw: string, key: CryptoKey }>} Base64文字列とCryptoKey
 */
export async function generateAESKey() {
  // AES鍵を生成
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Base64で共有できる形に変換
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  const rawBase64 = btoa(String.fromCharCode(...new Uint8Array(raw)));

  return { raw: rawBase64, key: aesKey };
}

/**
 * ✅ RSA-OAEP 鍵ペアを生成（2048bit）
 * @returns {Promise<{ publicKeyPem: string, privateKeyPem: string, keyPair: CryptoKeyPair }>}
 */
export async function generateRSAKeyPair() {
  // RSA-OAEP 鍵ペアを生成
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  // --- 公開鍵をPEM形式に ---
  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const spkiB64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const publicKeyPem =
    `-----BEGIN PUBLIC KEY-----\n${spkiB64.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;

  // --- 秘密鍵をPEM形式に ---
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const pkcs8B64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  const privateKeyPem =
    `-----BEGIN PRIVATE KEY-----\n${pkcs8B64.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`;

  return { publicKeyPem, privateKeyPem, keyPair };
}
