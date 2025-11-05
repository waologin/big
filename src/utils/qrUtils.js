// src/utils/qrUtils.js
import QRCode from "qrcode";
import jsQR from "jsqr";

/**
 * 任意データをQRコード(Base64 PNG)に変換
 * @param {Object|string} data
 * @returns {Promise<string>} Base64 PNGデータURL
 */
export async function encodeToQR(data) {
  try {
    const text = typeof data === "string" ? data : JSON.stringify(data);
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      width: 300,
      margin: 2,
      scale: 4,
    });
  } catch (err) {
    console.error("QR生成エラー:", err);
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
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, image.width, image.height);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const qr = jsQR(imageData.data, image.width, image.height);

    return qr ? qr.data : null;
  } catch (err) {
    console.error("QR解析エラー:", err);
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
    // JSON文字列化して圧縮・エンコード
    const json = JSON.stringify(info);
    const compressed = btoa(json); // 今は簡易Base64（必要ならLZ圧縮などに変更可）
    return await encodeToQR(compressed);
  } catch (err) {
    console.error("接続QR生成エラー:", err);
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
    const decoded = atob(qrText);
    return JSON.parse(decoded);
  } catch (err) {
    console.error("接続QR復号エラー:", err);
    return null;
  }
}
