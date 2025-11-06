self.addEventListener("push", event => {
  const data = event.data?.text();
  if (!data) return;

  try {
    const msg = JSON.parse(data);

    // --- ハンドシェイク応答処理 ---
    if (msg.type === "handshake") {
      event.waitUntil(handleHandshakeMessage(msg));
      return;
    }

    // --- 通常メッセージ処理 ---
    if (msg.type === "message") {
      event.waitUntil(handleEncryptedMessage(msg));
      return;
    }

  } catch (e) {
    console.error("Push受信エラー:", e);
  }
});
