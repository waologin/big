// src/crypto/aes.js
import { bufToBase64Url, base64UrlToBuf } from './base64.js';

const AES_ALGO = { name: 'AES-GCM', length: 256 };
const IV_BYTES = 12;

// AES キー生成（CryptoKey）
export async function generateAesKey() {
  return await window.crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt']);
}

// export raw key bytes (Uint8Array)
export async function exportAesRaw(key) {
  const ab = await window.crypto.subtle.exportKey('raw', key);
  return new Uint8Array(ab);
}

// import raw key bytes -> CryptoKey
export async function importAesRaw(rawBytes) {
  return await window.crypto.subtle.importKey('raw', rawBytes, AES_ALGO, true, ['encrypt', 'decrypt']);
}

// encrypt: plaintext (Uint8Array or string) -> { ciphertextBase64Url, ivBase64Url }
export async function encryptWithAesKey(key, plaintext) {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;
  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc
  );
  return {
    ciphertext: bufToBase64Url(ct),
    iv: bufToBase64Url(iv)
  };
}

// decrypt: ciphertextBase64Url + ivBase64Url -> plaintext Uint8Array (or string helper)
export async function decryptWithAesKey(key, ciphertextBase64Url, ivBase64Url) {
  const ctBuf = base64UrlToBuf(ciphertextBase64Url);
  const ivBuf = base64UrlToBuf(ivBase64Url);
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuf) },
    key,
    ctBuf
  );
  return new Uint8Array(plain); // caller can TextDecoder.decode(...)
}
