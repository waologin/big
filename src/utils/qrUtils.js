// src/utils/qrUtils.js
// QRユーティリティ（堅牢版：動的フェールバックで外部ライブラリを読み込み）
// 使う側はこれまで通り： encodeToQR(), decodeFromQR(), generateConnectionQR(), parseConnectionQR()

let _QRCode = null;
let _jsQR = null;

/* ---------- ヘルパー: script を動的挿入 ---------- */
function loadScriptTag(url) {
  return new Promise((resolve, reject) => {
    // 既に読み込まれている場合は即解決
    if (document.querySelector(`script[src="${url}"]`)) return resolve(url);
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve(url);
    s.onerror = () => reject(new Error(`Script load failed: ${url}`));
    document.head.appendChild(s);
  });
}

/* ---------- 動的ライブラリ読み込み（優先順） ---------- */
async function ensureQRCodeLib() {
  if (_QRCode) return _QRCode;

  // try jsdelivr ESM
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.esm.js");
    _QRCode = mod?.default || mod;
    console.log("[qrUtils] loaded qrcode from jsdelivr esm");
    return _QRCode;
  } catch (e) {
    console.warn("[qrUtils] jsdelivr esm qrcode failed:", e.message);
  }

  // try esm.sh
  try {
    const mod = await import("https://esm.sh/qrcode@1.5.3");
    _QRCode = mod?.default || mod;
    console.log("[qrUtils] loaded qrcode from esm.sh");
    return _QRCode;
  } catch (e) {
    console.warn("[qrUtils] esm.sh qrcode failed:", e.message);
  }

  // fallback: UMD via script tag (unpkg)
  try {
    await loadScriptTag("https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js");
    // UMD may expose `QRCode` or `qrcode`
    _QRCode = window.QRCode || window.qrcode || null;
    if (_QRCode) {
      console.log("[qrUtils] loaded qrcode from unpkg UMD");
      return _QRCode;
    } else {
      throw new Error("UMD qrcode did not expose global");
    }
  } catch (e) {
    console.error("[qrUtils] qrcode load all strategies failed:", e);
    throw e;
  }
}

async function ensureJsQR() {
  if (_jsQR) return _jsQR;

  // try jsdelivr mjs
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.mjs");
    _jsQR = mod?.default || mod;
    console.log("[qrUtils] loaded jsQR from jsdelivr mjs");
    return _jsQR;
  } catch (e) {
    console.warn("[qrUtils] jsdelivr jsQR failed:", e.message);
  }

  // try esm.sh
  try {
    const mod = await import("https://esm.sh/jsqr@1.4.0");
    _jsQR = mod?.default || mod;
    console.log("[qrUtils] loaded jsQR from esm.sh");
    return _jsQR;
  } catch (e) {
    console.warn("[qrUtils] esm.sh jsQR failed:", e.message);
  }

  // fallback: UMD via script tag (unpkg)
  try {
    await loadScriptTag("https://unpkg.com/jsqr@1.4.0/dist/jsQR.js");
    // UMD exposes `jsQR` global
    _jsQR = window.jsQR || null;
    if (_jsQR) {
      console.log("[qrUtils] loaded jsQR from unpkg UMD");
      return _jsQR;
    } else {
      throw new Error("UMD jsQR did not expose global");
    }
  } catch (e) {
    console.error("[qrUtils] jsQR load all strategies failed:", e);
    throw e;
  }
}

/* ---------- 公開API ---------- */

export async function encodeToQR(data) {
  try {
    const QR = await ensureQRCodeLib();
    console.log("[qrUtils] 📤 QR生成開始:", data);
    const text = typeof data === "string" ? data : JSON.stringify(data);

    // QRCode lib API differences:
    // - ESM/UMD qrcode supports toDataURL / toCanvas / toString
    if (QR.toDataURL) {
      const url = await QR.toDataURL(text, {
        errorCorrectionLevel: "M",
        width: 300,
        margin: 2,
        scale: 4,
      });
      console.log("[qrUtils] ✅ QR生成成功 (toDataURL)");
      return url;
    }

    // fallback: use generator api if available (qrcode-generator)
    if (typeof QR === "function") {
      // qrcode-generator style (create img tag)
      const qrObj = QR(0, "M");
      qrObj.addData(text);
      qrObj.make();
      // convert to dataURL via created image element
      const imgTag = qrObj.createImgTag(4); // <img src=...>
      // extract src
      const m = imgTag.match(/src="([^"]+)"/);
      if (m && m[1]) {
        console.log("[qrUtils] ✅ QR生成成功 (qrcode-generator)");
        return m[1];
      }
    }

    throw new Error("QRCode library doesn't support toDataURL or qrcode-generator interface");
  } catch (err) {
    console.error("[qrUtils] ❌ QR生成エラー:", err);
    throw err;
  }
}

/**
 * image: HTMLImageElement or HTMLCanvasElement
 */
export async function decodeFromQR(image) {
  try {
    console.log("[qrUtils] 🔍 QR解析開始");
    const jsqr = await ensureJsQR();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, image.width, image.height);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    // jsQR expects Uint8ClampedArray
    const qr = jsqr(imageData.data, image.width, image.height);

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

export async function generateConnectionQR(info) {
  try {
    console.log("[qrUtils] 🧩 接続QR生成開始:", info);
    const json = JSON.stringify(info);
    const compressed = btoa(json);
    const url = await encodeToQR(compressed);
    console.log("[qrUtils] ✅ 接続QR生成成功");
    return url;
  } catch (err) {
    console.error("[qrUtils] ❌ 接続QR生成エラー:", err);
    throw err;
  }
}

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
