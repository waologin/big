// src/utils/sessionStore.js

export function saveSession(deviceId, data) {
  localStorage.setItem(`session_${deviceId}`, JSON.stringify(data));
}

export function loadSession(deviceId) {
  const s = localStorage.getItem(`session_${deviceId}`);
  return s ? JSON.parse(s) : null;
}

export function listSessions() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith("session_"))
    .map(k => ({ key: k, data: JSON.parse(localStorage[k]) }));
}

export function clearSession(deviceId) {
  localStorage.removeItem(`session_${deviceId}`);
}
