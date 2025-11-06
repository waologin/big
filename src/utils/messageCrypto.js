// src/utils/messageCrypto.js
// AESベースのメッセージ暗号化 / 復号 と、送信ラッパー（secureSendPush を用いた送信）
// 依存: src/utils/cryptoUtils.js の aesEncrypt/aesDecrypt/toBase64/fromBase64 など
//        src/utils/secureSendPush.js (send wrapper) を使って中継サーバへ送信する関数も用意

import { aesEncrypt, aesDecrypt, toBase64, fromBase64 } from "./cryptoUtils.js";
import { importAESKeyFromBase64 as _importAESKeyFromBase64 } from "./cryptoUtils.js"; // もし既にある場合
import { secureSendPush } from "./secureSendPush.js";

/* ------------------------------------------------------------------
   AES鍵のimport/exportユーティリティ
   AES鍵は base64(raw bytes) 形式で保存される想定
   ------------------------------------------------------------------ */

/**
 * base64(raw) -> CryptoKey (AES-GCM)
 * @param {string} aesBase64 - base64 表示された raw AES key (256bit)
 * @returns {Promise<CryptoKey>}
 */
export async function importAESKeyFromBase64(aesBase64) {
  if (!aesBase64) throw new Error("aesBase64 required");
  const rawBuf = fromBase64(aesBase64); // returns ArrayBuffer
  return crypto.subtle.importKey(
    "raw",
    rawBuf,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * CryptoKey -> base64(raw)
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<string>}
 */
export async function exportAESKeyToBase64(cryptoKey) {
  const raw = await crypto.subtle.exportKey("raw", cryptoKey);
  return toBase64(raw);
}

/* ------------------------------------------------------------------
   メッセージ暗号化 / 復号
   出力は base64 表現（ciphertext, iv）
   ------------------------------------------------------------------ */

/**
 * AESで任意オブジェクトを暗号化して base64 結果を返す
 * @param {string} aesBase64 - AES鍵 (base64 raw)
 * @param {Object} messageObj - 暗号化したいオブジェクト
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function encryptMessage(aesBase64, messageObj) {
  try {
    const key = await importAESKeyFromBase64(aesBase64);
    const plaintext = JSON.stringify(messageObj);
    const res = await aesEncrypt(key, plaintext); // { iv: base64, ciphertext: base64 } と想定
    // aesEncrypt 実装による戻り値名を尊重：res.ciphertext, res.iv
    return {
      ciphertext: res.ciphertext,
      iv: res.iv
    };
  } catch (err) {
    console.error("encryptMessage error:", err);
    throw err;
  }
}

/**
 * AES復号してオブジェクトとして返す
 * @param {string} aesBase64
 * @param {string} ciphertextBase64
 * @param {string} ivBase64
 * @returns {Promise<Object>}
 */
export async function decryptMessage(aesBase64, ciphertextBase64, ivBase64) {
  try {
    const key = await importAESKeyFromBase64(aesBase64);
    const plain = await aesDecrypt(key, ciphertextBase64, ivBase64);
    return JSON.parse(plain);
  } catch (err) {
    console.error("decryptMessage error:", err);
    throw err;
  }
}

/* ------------------------------------------------------------------
   送信ラッパー（任意）
   secureSendPush を使って中継サーバにメッセージを投げるユーティリティ
   params: { senderId, recipientId } を渡し、 message 部分に暗号化ペイロードを入れる
   ------------------------------------------------------------------ */

/**
 * AESで暗号化して secureSendPush 経由で送信する
 * @param {string} aesBase64 - 共有AES鍵（受信側とのセッションで共有されているもの）
 * @param {Object} messageObj - 送信するメッセージ内容（オブジェクト）
 * @param {Object} params - { senderId, recipientId }
 * @param {Object} recipientSubscription - 受信側のPush購読情報（endpoint, keys）
 * @returns {Promise<Object>} secureSendPush のレスポンス（json）
 */
export async function sendEncryptedMessage(aesBase64, messageObj, params, recipientSubscription) {
  try {
    // 1) 暗号化
    const { ciphertext, iv } = await encryptMessage(aesBase64, messageObj);

    // 2) 格納するメッセージペイロードの構成（受信側が decryptMessage で復号する想定）
    const payload = {
      type: "message",
      ts: new Date().toISOString(),
      from: params.senderId,
      body: {
        ciphertext,
        iv
      }
    };

    // 3) secureSendPush へ投げる（message は文字列化して渡す）
    const sendParams = {
      senderId: params.senderId,
      recipientId: params.recipientId,
      message: JSON.stringify(payload)
    };

    const resp = await secureSendPush(sendParams, recipientSubscription);
    // 可能であれば json を返す
    let body = null;
    try {
      body = await resp.json();
    } catch (e) {
      body = await resp.text().catch(() => null);
    }
    if (!resp.ok) {
      throw new Error(`sendEncryptedMessage: server responded ${resp.status} - ${JSON.stringify(body)}`);
    }
    return body;
  } catch (err) {
    console.error("sendEncryptedMessage error:", err);
    throw err;
  }
}

/* ------------------------------------------------------------------
   テスト用ヘルパー（デバッグ）
   ------------------------------------------------------------------ */
export async function selfTestRoundTrip(aesBase64, obj) {
  // encrypt -> decrypt が正しく動くかの自己検証
  const enc = await encryptMessage(aesBase64, obj);
  const dec = await decryptMessage(aesBase64, enc.ciphertext, enc.iv);
  return { enc, dec };
}
