// src/main/B_side.js
// B側: QR 読取 → respondToOfferFromQR 実行 → Aに暗号化したAESと自分の購読情報を送信

import { decodeFromQR, parseConnectionQR } from "../src/utils/qrUtils.js";
import { respondToOfferFromQR } from "../src/utils/handshake.js";

const EL = {
  fileInput: null,
  btnFromFile: null,
  pasteArea: null,
  btnPaste: null,
  log: null
};

function log(msg) {
  console.log("[B]", msg);
  if (EL.log) EL.log.textContent += msg + "\n";
}

export async function mountB(rootId = "app") {
  const root = document.getElementById(rootId) || document.body;
  root.innerHTML = `
    <h3>B: QRを読み取って応答する</h3>
    <input id="qrfile" type="file" accept="image/*" />
    <button id="btnFile">画像から読み取る</button>
    <div style="margin-top:1rem;">
      <label>または QR テキストを貼る（Base64内包の場合）</label><br/>
      <textarea id="paste" style="width:100%;height:100px"></textarea>
      <button id="btnPaste">テキストから応答</button>
    </div>
    <pre id="blog" style="height:120px;overflow:auto;background:#f8faf8;padding:8px"></pre>
  `;
  EL.fileInput = document.getElementById("qrfile");
  EL.btnFromFile = document.getElementById("btnFile");
  EL.pasteArea = document.getElementById("paste");
  EL.btnPaste = document.getElementById("btnPaste");
  EL.log = document.getElementById("blog");

  EL.btnFromFile.addEventListener("click", async () => {
    const f = EL.fileInput.files && EL.fileInput.files[0];
    if (!f) {
      log("⚠️ 画像ファイルを選択してください");
      return;
    }
    try {
      const img = await fileToImage(f);
      const decoded = await decodeFromQR(img);
      if (!decoded) {
        log("❌ QRの解析に失敗しました");
        return;
      }
      // decoded は compressed base64 -> parseConnectionQR で JSON が得られる
      const parsed = parseConnectionQR(decoded);
      if (!parsed) {
        log("❌ QR中身の解析失敗");
        return;
      }
      log("✅ QR解析完了: " + JSON.stringify({ deviceId: parsed.deviceId || parsed.deviceId }));
      // ここで respondToOfferFromQR を呼ぶ。内部で通知許可・購読作成も行われる
      const resp = await respondToOfferFromQR(parsed, { serviceWorkerPath: "/service-worker.js" });
      if (resp.error) {
        log("❌ 応答送信エラー: " + resp.error + (resp.detail ? " detail:" + JSON.stringify(resp.detail) : ""));
      } else {
        log("✅ 応答送信成功: " + JSON.stringify(resp.sendResp || resp));
      }
    } catch (err) {
      log("❌ 例外: " + err.message);
    }
  });

  EL.btnPaste.addEventListener("click", async () => {
    const text = EL.pasteArea.value.trim();
    if (!text) {
      log("⚠️ QRテキストを貼ってください");
      return;
    }
    try {
      // text は QR の中身（Base64）、または既に JSON オブジェクト文字列の可能性がある
      let parsed;
      try {
        parsed = parseConnectionQR(text);
      } catch (e) {
        // fallback: try parse as JSON directly
        try { parsed = JSON.parse(text); } catch (ee) { parsed = null; }
      }
      if (!parsed) {
        log("❌ QRテキスト解析失敗");
        return;
      }
      const resp = await respondToOfferFromQR(parsed, { serviceWorkerPath: "/service-worker.js" });
      if (resp.error) {
        log("❌ 応答送信エラー: " + resp.error + (resp.detail ? " detail:" + JSON.stringify(resp.detail) : ""));
      } else {
        log("✅ 応答送信成功: " + JSON.stringify(resp.sendResp || resp));
      }
    } catch (err) {
      log("❌ 例外: " + err.message);
    }
  });

  // helper
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // autoload mount
  if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
      setTimeout(() => { /* noop */ }, 0);
    });
  }
}
