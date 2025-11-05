// src/crypto/handler.js
import { decryptWithPrivateKeyBase64Url } from './rsa.js';
import { importAesRaw, decryptWithAesKey } from './aes.js';

// assumes privateKey is a CryptoKey available in memory (or fetched from keyStore)
// returns parsed JSON { k_chat: base64url rawKey, authB: {...} } or throws
export async function decryptEncForA(payload, privateKeyCrypto) {
  if (!payload || !payload.wrappedKeyForA || !payload.encForA || !payload.ivForA) {
    throw new Error('payload missing expected fields for encForA');
  }

  // 1) unwrap AES key (raw bytes)
  const aesRawUint8 = await decryptWithPrivateKeyBase64Url(privateKeyCrypto, payload.wrappedKeyForA);
  // 2) import AES key
  const aesKey = await importAesRaw(aesRawUint8);
  // 3) decrypt encForA
  const plainBytes = await decryptWithAesKey(aesKey, payload.encForA, payload.ivForA);
  const jsonText = new TextDecoder().decode(plainBytes);
  const obj = JSON.parse(jsonText);
  // Expect obj: { k_chat: "<base64url raw>", authB: {...} }
  return obj;
}

// helper to convert k_chat base64url raw to CryptoKey
import { base64UrlToBuf } from './base64.js';
export async function importKChatFromBase64Url(kChatBase64Url) {
  const ab = base64UrlToBuf(kChatBase64Url);
  return importAesRaw(new Uint8Array(ab));
}
