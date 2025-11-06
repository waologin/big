// src/utils/handshake.js

import { generateAESKey, generateRSAKeyPair } from "./cryptoKeyGen.js";
import { aesEncrypt, toBase64, fromBase64, importPublicKey, rsaEncrypt } from "./cryptoUtils.js";
import { generateConnectionQR, parseConnectionQR } from "./qrUtils.js";
import { requestNotificationPermission } from "./requestNotificationPermission.js";
import { secureSendPush } from "./secureSendPush.js";

/**
 * A側：Offer を作成して QR (DataURL) を返す
 * - serviceWorkerPath: 登録する service-worker のパス（絶対パス推奨）
 * - deviceId: 任意の識別子。未指定ならランダムUUIDを作る
 *
 * 戻り値:
 * {
 *   qrDataUrl,           // 表示用QR DataURL
 *   publicKeyPem,
 *   privateKeyPem,       // かならずローカルに保存しておく（ここでも返す）
 *   subscription         // Aの購読情報（endpoint, keys）
 * }
 */
export async function createOffer({
  serviceWorkerPath = "/service-worker.js",
  deviceId = null,
} = {}) {
  try {
    // deviceId default
    if (!deviceId) deviceId = cryptoRandomUuid();

    // 1) SW登録 + 通知許可 + 購読取得
    const registration = await navigator.serviceWorker.register(serviceWorkerPath);
    const reqRes = await requestNotificationPermission(registration);
    if (reqRes?.error) throw new Error("通知購読エラー: " + reqRes.error);
    // requestNotificationPermission may return { subscription } or subscription directly
    const subscription = reqRes.subscription ?? reqRes;

    if (!subscription || !subscription.endpoint) {
      throw new Error("購読情報が取得できませんでした");
    }

    // 2) RSA 鍵ペア生成（PEM）
    const { publicKeyPem, privateKeyPem } = await generateRSAKeyPair();

    // 3) QR ペイロード構成
    const payload = {
      type: "offer",
      version: 1,
      deviceId,
      publicKeyPem,
      subscription, // A の購読情報（Bがこれを使ってAに送信）
      ts: new Date().toISOString()
    };

    // 4) QR生成（dataURL）
    const qrDataUrl = await generateConnectionQR(payload);

    // 5) 秘密鍵をローカルに保存（復号時に使うため）
    // 名前空間をつけて保存
    try {
      localStorage.setItem(`handshake_privateKeyPem_${deviceId}`, privateKeyPem);
    } catch (e) {
      // 保存できない場合は警告するが処理は続ける（戻り値で秘密鍵を返す）
      console.warn("localStorage に秘密鍵を保存できませんでした:", e);
    }

    return {
      qrDataUrl,
      publicKeyPem,
      privateKeyPem,
      subscription,
      deviceId,
    };
  } catch (err) {
    console.error("createOffer error:", err);
    return { error: err.message || String(err) };
  }
}

/**
 * B側：QRテキスト（もしくはQRから得たJSON）を受け取って応答を送信する
 * - qrText: QRから読み取った文字列（parseConnectionQR 前の生文字列） または offer オブジェクト
 * - opts:
 *    serviceWorkerPath: SW登録パス
 *    deviceId: 自身の識別子（なければランダム）
 *
 * 戻り値:
 * { ok: true, sendResp: <server response JSON> } または { error: '...' }
 */
export async function respondToOfferFromQR(qrTextOrObj, {
  serviceWorkerPath = "/service-worker.js",
  deviceId = null,
} = {}) {
  try {
    if (!deviceId) deviceId = cryptoRandomUuid();

    // 1) parse QR（もし文字列ならparse、すでにオブジェクトならそのまま）
    let offer;
    if (typeof qrTextOrObj === "string") {
      offer = parseConnectionQR(qrTextOrObj);
    } else {
      offer = qrTextOrObj;
    }
    if (!offer || offer.type !== "offer" || !offer.publicKeyPem || !offer.subscription) {
      throw new Error("不正なOffer QRです");
    }

    // 2) SW 登録 + 通知許可 & 自分（B）の購読取得
    const registration = await navigator.serviceWorker.register(serviceWorkerPath);
    const reqRes = await requestNotificationPermission(registration);
    if (reqRes?.error) throw new Error("通知購読エラー: " + reqRes.error);
    const mySubscription = reqRes.subscription ?? reqRes;
    if (!mySubscription || !mySubscription.endpoint) {
      throw new Error("自身の購読情報が取得できませんでした");
    }

    // 3) AES鍵生成（共通鍵）。rawBase64 と CryptoKey を取得
    const { raw: aesRawBase64, key: aesCryptoKey } = await generateAESKey();

    // 4) AES鍵の raw を ArrayBuffer にして、Aの公開鍵で RSA-OAEP 暗号化（wrappedKey: base64）
    //    cryptoUtils.rsaEncrypt は publicKey(CryptoKey) と ArrayBuffer を受け付ける前提
    const pubKey = await importPublicKey(offer.publicKeyPem);
    // rawBase64 -> ArrayBuffer
    const rawBuf = fromBase64(aesRawBase64);
    const wrappedKey = await rsaEncrypt(pubKey, rawBuf); // base64

    // 5) AESで自分の購読情報を暗号化（AがAESを復号して得る）
    const { iv, ciphertext } = await aesEncrypt(aesCryptoKey, JSON.stringify(mySubscription));
    // aesEncrypt の戻りは { iv: base64, ciphertext: base64 }（呼び出し実装に合わせている）

    // 6) パラメータ作成（message の中に handshake 情報を格納）
    const handshakePayload = {
      type: "handshake",
      version: 1,
      from: deviceId,
      wrappedKey,        // Aの公開鍵で暗号化したAES鍵（base64）
      encBSub: ciphertext, // AESで暗号化したBの購読（base64）
      iv,                // AESのiv（base64）
      ts: new Date().toISOString()
    };

    const params = {
      senderId: deviceId,
      recipientId: offer.deviceId || "unknown",
      message: JSON.stringify(handshakePayload),
    };

    // 7) Aに送信（secureSendPush を利用。第二引数は A の購読情報）
    // secureSendPush(params, subscriptionToSendTo)
    const sendResp = await secureSendPush(params, offer.subscription);

    // 8) success 判定
    let resultBody = null;
    try {
      resultBody = await sendResp.json();
    } catch (e) {
      resultBody = await sendResp.text().catch(() => null);
    }

    if (!sendResp.ok) {
      return { error: `sendPush failed (${sendResp.status})`, detail: resultBody };
    }

    return { ok: true, sendResp: resultBody };

  } catch (err) {
    console.error("respondToOfferFromQR error:", err);
    return { error: err.message || String(err) };
  }
}

/* ---------------------------
   ヘルパー
   --------------------------- */

// 簡易UUID（crypto API 利用）
function cryptoRandomUuid() {
  // RFC4122 v4 互換の簡易UUID
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  // set version bits
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = [...buf].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
