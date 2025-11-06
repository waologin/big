// src/utils/messageCrypto.js

import { aesEncrypt, aesDecrypt, importAESKeyFromBase64 } from "./cryptoUtils.js";

/**
 * AES暗号化メッセージ作成
 */
export async function encryptMessage(aesBase64, messageObj) {
  const key = await importAESKeyFromBase64(aesBase64);
  const { ciphertext, iv } = await aesEncrypt(key, JSON.stringify(messageObj));
  return { ciphertext, iv };
}

/**
 * AES復号メッセージ取得
 */
export async function decryptMessage(aesBase64, ciphertext, iv) {
  const key = await importAESKeyFromBase64(aesBase64);
  const json = await aesDecrypt(key, ciphertext, iv);
  return JSON.parse(json);
}
