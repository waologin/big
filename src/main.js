// src/main.js
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker登録成功:', reg.scope);
      return reg;
    } catch (err) {
      console.error('ServiceWorker登録失敗:', err);
    }
  } else {
    console.warn('ServiceWorker未対応ブラウザ');
  }
}

registerServiceWorker();
