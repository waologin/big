// src/crypto/rsa.js
import { bufToBase64Url, base64UrlToBuf } from './base64.js';

const RSA_ALGO = {
  name: 'RSA-OAEP',
  modulusLength: 3072,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: { name: 'SHA-256' }
};

// 1) 鍵ペア生成
export async function generateRsaKeyPair() {
  const kp = await window.crypto.subtle.generateKey(
    RSA_ALGO,
    true, // extractable public key (we will export), private key could be non-extractable if desired
    ['encrypt', 'decrypt']
  );
  return kp; // { publicKey, privateKey } CryptoKey objects
}

// 2) 公開鍵を SPKI base64url でエクスポート
export async function exportPublicKeySpkiBase64Url(publicKey) {
  const spki = await window.crypto.subtle.exportKey('spki', publicKey);
  return bufToBase64Url(spki);
}

// 3) 秘密鍵を PKCS8 base64url でエクスポート（デバッグ／バックアップ用。必要なら使う）
export async function exportPrivateKeyPkcs8Base64Url(privateKey) {
  const pkcs8 = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  return bufToBase64Url(pkcs8);
}

// 4) 公開鍵インポート（SPKI base64url）
export async function importPublicKeySpkiBase64Url(spkiBase64Url) {
  const ab = base64UrlToBuf(spkiBase64Url);
  return await window.crypto.subtle.importKey(
    'spki',
    ab,
    RSA_ALGO,
    true,
    ['encrypt']
  );
}

// 5) 秘密鍵インポート（PKCS8 base64url） — 必要なら使う
export async function importPrivateKeyPkcs8Base64Url(pkcs8Base64Url) {
  const ab = base64UrlToBuf(pkcs8Base64Url);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    ab,
    RSA_ALGO,
    true,
    ['decrypt']
  );
}

// 6) RSA-OAEP で暗号化（raw Uint8Array -> base64url）
export async function encryptWithPublicKeyBase64Url(pubKeyCrypto, rawUint8Array) {
  const ct = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    pubKeyCrypto,
    rawUint8Array
  );
  return bufToBase64Url(ct);
}

// 7) RSA-OAEP で復号（base64url -> ArrayBuffer）
export async function decryptWithPrivateKeyBase64Url(privKeyCrypto, wrappedBase64Url) {
  const ab = base64UrlToBuf(wrappedBase64Url);
  const plain = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKeyCrypto, ab);
  return new Uint8Array(plain); // Uint8Array raw bytes
}
