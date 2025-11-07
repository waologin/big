// src/utils/qrUtils.js
import QRCode from "https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js";
import jsQR from "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.mjs";

console.log("[qrUtils] ✅ モジュールロード完了");

/**
 * 任意データをQRコード(Base64 PNG)に変換
 * @param {Object|string} data
 * @returns {Promise<string>} Base64 PNGデータURL
 */
export async function encodeToQR(data) {
  try {
    console.log("[qrUtils] 📤 QR生成開始:", data);
    const text = typeof data === "string" ? data : JSON.stringify(data);
    const url = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      width: 300,
      margin: 2,
      scale: 4,
    });
    console.log("[qrUtils] ✅ QR生成成功");
    return url;
  } catch (err) {
    console.error("[qrUtils] ❌ QR生成エラー:", err);
    throw err;
  }
}

/**
 * CanvasImageSourceからQRコードを解析
 * @param {HTMLImageElement|HTMLCanvasElement} image
 * @returns {Promise<string|null>}
 */
export async function decodeFromQR(image) {
  try {
    console.log("[qrUtils] 🔍 QR解析開始");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, image.width, image.height);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const qr = jsQR(imageData.data, image.width, image.height);

    if (qr) {
      console.log("[qrUtils] ✅ QR解析成功:", qr.data);
      return qr.data;
    } else {
      console.warn("[qrUtils] ⚠️ QRコードが検出されませんでした");
      return null;
    }
  } catch (err) {
    console.error("[qrUtils] ❌ QR解析エラー:", err);
    throw err;
  }
}

/**
 * 🔐 接続情報QRを生成（AES鍵やRSA公開鍵を安全にQR化）
 * @param {Object} info - 共有したい情報
 * @returns {Promise<string>} Base64 PNGデータURL
 */
export async function generateConnectionQR(info) {
  try {
    console.log("[qrUtils] 🧩 接続QR生成開始:", info);
    const json = JSON.stringify(info);
    const compressed = btoa(json); // 今は簡易Base64（必要ならLZ圧縮などに変更可）
    const url = await encodeToQR(compressed);
    console.log("[qrUtils] ✅ 接続QR生成成功");
    return url;
  } catch (err) {
    console.error("[qrUtils] ❌ 接続QR生成エラー:", err);
    throw err;
  }
}

/**
 * 📦 QR文字列からオブジェクトを復元
 * @param {string} qrText - QR中の文字列（Base64圧縮形式）
 * @returns {Object|null}
 */
export function parseConnectionQR(qrText) {
  try {
    console.log("[qrUtils] 🔓 QRデータ復号開始");
    const decoded = atob(qrText);
    const obj = JSON.parse(decoded);
    console.log("[qrUtils] ✅ 復号成功:", obj);
    return obj;
  } catch (err) {
    console.error("[qrUtils] ❌ 接続QR復号エラー:", err);
    return null;
  }
}
