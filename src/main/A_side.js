import { startHandshakeAsA } from './src/utils/handshake.js';
import { saveSession } from './src/utils/sessionStore.js';

export async function initAHandshakeUI() {
  const btn = document.getElementById('generateQRBtn');
  const qrCanvas = document.getElementById('qrCanvas');
  const status = document.getElementById('status');

  btn.addEventListener('click', async () => {
    try {
      status.textContent = '🔄 鍵を生成中...';
      const qrDataUrl = await startHandshakeAsA();

      const img = document.createElement('img');
      img.src = qrDataUrl;
      img.alt = 'Handshake QR';
      img.style.width = '240px';
      img.style.height = '240px';

      qrCanvas.innerHTML = '';
      qrCanvas.appendChild(img);
      status.textContent = '✅ QRをスキャンしてB側で接続してください。';
    } catch (err) {
      console.error(err);
      status.textContent = '❌ エラー: ' + err.message;
    }
  });
}

document.addEventListener('DOMContentLoaded', initAHandshakeUI);
