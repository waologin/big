import jsQR from "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.mjs";

console.log("[qrUtils] ✅ モジュールロード開始 (完全デバッグ版)");

const QR_CDN = "https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js";
let QRCodeLib = null;

export async function loadQRCodeLib() {
  console.group("[qrUtils.loadQRCodeLib]");
  try {
    console.log("🔍 現在の window.QRCode:", window.QRCode);
    if (QRCodeLib) {
      console.log("📦 既にキャッシュ済み QRCodeLib を返します");
      console.groupEnd();
      return QRCodeLib;
    }
    if (typeof window !== "undefined" && window.QRCode) {
      console.log("✅ window.QRCode が既に存在します");
      QRCodeLib = window.QRCode;
      console.groupEnd();
      return QRCodeLib;
    }

    const existing = Array.from(document.getElementsByTagName("script")).find(
      (s) => s.src && s.src.includes("qrcode.min.js"),
    );
    if (existing) {
      console.log("🧩 既存の script タグを検出:", existing.src);
    } else {
      console.log("⚙️ 既存 script がないので新規ロードします");
    }

    return new Promise((resolve, reject) => {
      const done = () => {
        console.log("➡️ onload 実行中");
        if (window.QRCode) {
          QRCodeLib = window.QRCode;
          console.log("✅ QRCode ライブラリロード成功!");
          console.groupEnd();
          resolve(QRCodeLib);
        } else {
          console.error("❌ ロード済みだが window.QRCode が未定義");
          console.groupEnd();
          reject(new Error("window.QRCode not found after script load"));
        }
      };

      if (existing && window.QRCode) {
        console.log("♻️ 既存 script + window.QRCode を使用");
        done();
        return;
      }

      const s = document.createElement("script");
      s.src = QR_CDN;
      s.async = true;
      s.onload = done;
      s.onerror = (ev) => {
        console.error("❌ QRCodeスクリプトロード失敗", ev);
        console.groupEnd();
        reject(new Error("Failed to load QRCode script"));
      };
      document.head.appendChild(s);
      console.log("🌐 QRCode ライブラリ読み込み開始:", s.src);
    });
  } catch (err) {
    console.error("❌ loadQRCodeLib 例外:", err);
    console.groupEnd();
    throw err;
  }
}

export async function encodeToQR(data) {
  console.group("[qrUtils.encodeToQR]");
  try {
    console.log("📤 QR生成開始:", data);
    console.log("🕓 QRCodeLib ロードを待機中…");
    const QRCode = await loadQRCodeLib();
    console.log("✅ QRCodeLib ロード完了:", !!QRCode, QRCode);

    if (!QRCode || typeof QRCode.toDataURL !== "function") {
      console.error("❌ QRCode.toDataURL が利用不可！", QRCode);
      throw new Error("QRCode.toDataURL not available");
    }

    const text = typeof data === "string" ? data : JSON.stringify(data);
    console.log("🧩 QR変換対象テキスト:", text);

    const url = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      width: 300,
      margin: 2,
      scale: 4,
    });

    console.log("✅ QR生成成功 → DataURL 長さ:", url?.length);
    console.groupEnd();
    return url;
  } catch (err) {
    console.error("❌ QR生成エラー:", err, err?.message, err?.stack);
    console.groupEnd();
    throw err;
  }
}

export async function decodeFromQR(image) {
  console.group("[qrUtils.decodeFromQR]");
  try {
    console.log("🔍 QR解析開始:", image);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const w = image.width || image.naturalWidth || image.videoWidth;
    const h = image.height || image.naturalHeight || image.videoHeight;
    console.log("🧮 サイズ:", { w, h });
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(image, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    console.log("🧬 画像データ取得:", imageData);
    const qr = jsQR(imageData.data, w, h);
    if (qr) {
      console.log("✅ QR解析成功:", qr.data);
      console.groupEnd();
      return qr.data;
    } else {
      console.warn("⚠️ QRコードが検出されませんでした");
      console.groupEnd();
      return null;
    }
  } catch (err) {
    console.error("❌ QR解析エラー:", err);
    console.groupEnd();
    throw err;
  }
}

export async function generateConnectionQR(info) {
  console.group("[qrUtils.generateConnectionQR]");
  try {
    console.log("🧩 接続QR生成開始:", info);
    const json = JSON.stringify(info);
    const compressed = btoa(json);
    console.log("📦 Base64化:", compressed);
    const url = await encodeToQR(compressed);
    console.log("✅ 接続QR生成成功");
    console.groupEnd();
    return url;
  } catch (err) {
    console.error("❌ 接続QR生成エラー:", err);
    console.groupEnd();
    throw err;
  }
}

export function parseConnectionQR(qrText) {
  console.group("[qrUtils.parseConnectionQR]");
  try {
    console.log("🔓 QRデータ復号開始:", qrText);
    const decoded = atob(qrText);
    console.log("📜 Base64 decode:", decoded);
    const obj = JSON.parse(decoded);
    console.log("✅ 復号成功:", obj);
    console.groupEnd();
    return obj;
  } catch (err) {
    console.error("❌ 接続QR復号エラー:", err);
    console.groupEnd();
    return null;
  }
}
