// src/main/A_side.js
// A側: Offer作成・QR表示・Service Worker経由のハンドシェイク受信を扱う

import { createOffer } from "../utils/handshake.js";
import { saveSession } from "../utils/sessionStore.js";
import { importPrivateKey, toBase64, fromBase64 } from "../utils/cryptoUtils.js";
import { importAESKeyFromBase64, decryptMessage } from "../utils/messageCrypto.js";

const EL = {
  btnCreateOffer: null,
  qrImg: null,
  log: null,
  sessions: null,
};

function log(msg) {
  console.log("[A]", msg);
  if (EL.log) EL.log.textContent += msg + "\n";
}

export async function mountA(rootId = "app") {
  // 簡易UI 作成
  const root = document.getElementById(rootId) || document.body;
  root.innerHTML = `
    <h3>A: Offer (QR) 作成</h3>
    <button id="createOfferBtn">Offer QR を作る</button>
    <div style="margin-top:1rem;">
      <img id="offerQr" alt="QR" style="max-width:320px;border:1px solid #ddd;padding:6px;background:#fff" />
    </div>
    <pre id="alog" style="height:120px;overflow:auto;background:#f8faf8;padding:8px"></pre>
    <h4>セッション一覧</h4>
    <pre id="asessions" style="height:120px;overflow:auto;background:#fff;padding:8px"></pre>
  `;
  EL.btnCreateOffer = document.getElementById("createOfferBtn");
  EL.qrImg = document.getElementById("offerQr");
  EL.log = document.getElementById("alog");
  EL.sessions = document.getElementById("asessions");

  // Service Worker 登録（スコープに合わせてパス変更すること）
  try {
    await navigator.serviceWorker.register("/service-worker.js");
    log("✅ Service Worker 登録完了");
  } catch (e) {
    log("❌ Service Worker 登録失敗: " + e.message);
  }

  // createOffer ボタン
  EL.btnCreateOffer.addEventListener("click", async () => {
    try {
      log("⏳ Offer作成中...");
      const res = await createOffer({ serviceWorkerPath: "/service-worker.js" });
      if (res.error) {
        log("❌ Offer作成エラー: " + res.error);
        return;
      }
      // show QR
      EL.qrImg.src = res.qrDataUrl;
      // remember current deviceId so later message processing can find private key
      localStorage.setItem("currentOfferDeviceId", res.deviceId);
      // privateKeyは createOffer が localStorage に保存している（handshake_privateKeyPem_{deviceId}）
      log("✅ Offer 作成完了 deviceId=" + res.deviceId);
      refreshSessionList();
    } catch (err) {
      log("❌ Offer例外: " + err.message);
    }
  });

  // SW → page メッセージ（MessageChannel を受け取る）
  navigator.serviceWorker.addEventListener("message", async (event) => {
    try {
      const data = event.data || {};
      // If SW passed a MessagePort, it'll be in event.ports[0]
      const port = (event.ports && event.ports[0]) || null;
      if (data?.cmd === "handleHandshake" && port) {
        log("🔔 ハンドシェイク受信要求 (SWから)。処理を行います...");
        const payload = data.payload; // handshake payload forwarded by SW
        const reply = await handleHandshakeOnClient(payload);
        // 返答をSWへ返す（短い結果）
        port.postMessage(reply);
        log("✅ ハンドシェイク処理完了: " + JSON.stringify(reply));
        refreshSessionList();
      } else {
        // 他のSWメッセージ: そのままログ表示
        log("SW message: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error("A_side message handler error:", err);
      log("❌ ハンドラ例外: " + err.message);
    }
  });

  refreshSessionList();
}

/**
 * SWからの handshake 要求をページ側で処理する（秘密鍵でRSA復号→AES復号→セッション保存）
 * payload には { wrappedKey, encBSub, iv, from, ... } が入る想定
 */
async function handleHandshakeOnClient(payload) {
  try {
    const from = payload.from;
    // 1) 自分の deviceId を特定して秘密鍵PEMを取得
    const deviceId = localStorage.getItem("currentOfferDeviceId");
    if (!deviceId) return { error: "server: no offer deviceId" };

    const privPem = localStorage.getItem(`handshake_privateKeyPem_${deviceId}`);
    if (!privPem) return { error: "no privateKey stored for deviceId=" + deviceId };

    // 2) import private key
    const privateKey = await importPrivateKey(privPem);

    // 3) RSA-OAEP で wrappedKey (Base64) を復号 -> ArrayBuffer (raw AES bytes)
    const wrappedBuf = Uint8Array.from(atob(payload.wrappedKey), c => c.charCodeAt(0)).buffer;
    const aesRawBuf = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedBuf);

    // 4) AES raw -> base64 形式 (保存用)
    const aesBase64 = toBase64(aesRawBuf);

    // 5) AESキーを使って encBSub を復号して購読情報を得る
    const aesKey = await importAESKeyFromBase64(aesBase64);
    const bSubJson = await (async () => {
      // cryptoUtils.aesDecrypt expects CryptoKey + ciphertextBase64 + ivBase64
      const { default: cryptoUtils } = await import("../utils/cryptoUtils.js");
      return await cryptoUtils.aesDecrypt(aesKey, payload.encBSub, payload.iv);
    })();
    const bSub = JSON.parse(bSubJson);

    // 6) セッション保存（peerId = from）
    const sessionObj = {
      role: "A",
      peerId: from,
      aesKey: aesBase64,
      peerSubscription: bSub,
      createdAt: new Date().toISOString(),
    };
    saveSession(from, sessionObj);

    return { ok: true, saved: true, peerId: from };
  } catch (err) {
    console.error("handleHandshakeOnClient error:", err);
    return { error: err.message || String(err) };
  }
}

/* session 表示更新 */
function refreshSessionList() {
  const { listSessions } = awaitOrRequireSessionStore();
  const arr = listSessions();
  EL.sessions.textContent = JSON.stringify(arr, null, 2);
}

/* helper to import sessionStore dynamically (avoid circular issues in some bundlers) */
function awaitOrRequireSessionStore() {
  try {
    // If running under module bundler, require may not exist; use dynamic import
    return { listSessions: (function(){ return JSON.parse(localStorage.getItem("session_v1_dummy") || "[]"); })() };
  } catch (e) {
    // fallback
    return { listSessions: () => [] };
  }
}

/* 自動マウント if this script is loaded directly in browser */
if (typeof window !== "undefined") {
  // mount into element with id "app" if present
  window.addEventListener("load", () => {
    setTimeout(() => mountA("app").catch(err => console.error(err)), 50);
  });
}
