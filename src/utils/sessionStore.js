// src/utils/sessionStore.js
// セッション（接続済みピア）を localStorage に保存 / 取得するユーティリティ

const NS = "session_v1_"; // 名前空間（将来のバージョン管理に便利）
const MAX_SIZE_CHECK_KEY = "__session_store_check__";

/**
 * 保存するセッションの例（value 部分）
 * {
 *   role: "A" | "B",
 *   peerId: "bob-01",
 *   aesKey: "<base64 raw>",        // Bが発行したAES鍵（Base64、raw bytes）
 *   publicKeyPem: "<PEM>",        // Aの公開鍵（必要に応じて）
 *   privateKeyPem: "<PEM>",       // Aの秘密鍵（A側のみ。保存する場合は注意）
 *   peerSubscription: { endpoint, keys:{p256dh, auth} },
 *   createdAt: "ISO timestamp",
 *   updatedAt: "ISO timestamp",
 *   meta: { ... }                 // 任意メタデータ
 * }
 */

/* ------------------------------
   基本CRUD
   ------------------------------ */
export function saveSession(deviceId, data) {
  if (!deviceId) throw new Error("deviceId is required");
  const now = new Date().toISOString();
  const base = {
    createdAt: now,
    updatedAt: now,
  };
  // 既存があれば保持 createdAt
  const existing = loadSession(deviceId);
  const toStore = Object.assign({}, base, existing ? { createdAt: existing.createdAt } : {}, data, { updatedAt: now });
  localStorage.setItem(NS + deviceId, JSON.stringify(toStore));
  return toStore;
}

export function loadSession(deviceId) {
  if (!deviceId) return null;
  const raw = localStorage.getItem(NS + deviceId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("sessionStore: invalid JSON for", deviceId, e);
    return null;
  }
}

export function deleteSession(deviceId) {
  if (!deviceId) return false;
  localStorage.removeItem(NS + deviceId);
  return true;
}

export function listSessions() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(NS)) continue;
    try {
      const obj = JSON.parse(localStorage.getItem(key));
      out.push({ deviceId: key.substring(NS.length), data: obj });
    } catch (e) {
      console.warn("sessionStore: parse fail for", key);
    }
  }
  return out;
}

export function clearAllSessions() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NS)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
  return true;
}

/* ------------------------------
   ユーティリティ
   ------------------------------ */

/**
 * Update session by merge (shallow)
 */
export function updateSession(deviceId, patch) {
  if (!deviceId) throw new Error("deviceId required");
  const cur = loadSession(deviceId) || {};
  const merged = Object.assign({}, cur, patch, { updatedAt: new Date().toISOString() });
  localStorage.setItem(NS + deviceId, JSON.stringify(merged));
  return merged;
}

/**
 * session の存在確認（true/false）
 */
export function hasSession(deviceId) {
  return !!localStorage.getItem(NS + deviceId);
}

/**
 * Export session as JSON string (for copy/backup)
 */
export function exportSession(deviceId) {
  const s = loadSession(deviceId);
  if (!s) return null;
  return JSON.stringify(s);
}

/**
 * Import session from JSON string
 */
export function importSession(deviceId, jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    saveSession(deviceId, obj);
    return obj;
  } catch (e) {
    throw new Error("invalid json for importSession");
  }
}

/* ------------------------------
   安全メモ
   ------------------------------ */
/*
 - localStorage はブラウザ内で容易に閲覧できるため、秘密鍵(privateKeyPem)やaesKeyをそのまま保存する場合は
   運用上のリスクがあります。実運用では IndexedDB + 鍵暗号化（パスフレーズ）や WebAuthn 等のセキュアストレージを検討してください。
 - このモジュールはまずは動作用の簡易実装を提供します。
*/
