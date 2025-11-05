// src/push/handler.js
// Page-side ServiceWorker message handler and dispatcher.
// Responsibilities:
//  - listen to messages from SW
//  - dispatch to registered callbacks (push, control, notificationClick)
//  - provide helpers to request SW to fetch large payloads

const listeners = {
  push: [],
  control: [],
  notificationClick: [],
  fetchedMessage: []
};

export function listenToSWMessages() {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (!msg || !msg.kind) return;
    switch (msg.kind) {
      case 'push':
        // msg.payload contains the push payload (possibly encrypted)
        listeners.push.forEach(fn => {
          try { fn(msg.payload); } catch (e) { console.error(e); }
        });
        break;
      case 'control':
        listeners.control.forEach(fn => { try { fn(msg); } catch (e) { console.error(e); } });
        break;
      case 'notificationClick':
        listeners.notificationClick.forEach(fn => { try { fn(msg.data); } catch (e) { console.error(e); } });
        break;
      case 'fetchedMessage':
        listeners.fetchedMessage.forEach(fn => { try { fn(msg.data, msg.requestId); } catch (e) { console.error(e); } });
        break;
      case 'subscriptionChange':
        // advise client to re-subscribe
        listeners.control.forEach(fn => { try { fn({ type: 'subscriptionChange' }); } catch (e) { console.error(e); } });
        break;
      default:
        console.warn('[push/handler] unknown kind', msg.kind);
    }
  });
}

export function onPush(fn) { listeners.push.push(fn); }
export function onControl(fn) { listeners.control.push(fn); }
export function onNotificationClick(fn) { listeners.notificationClick.push(fn); }
export function onFetchedMessage(fn) { listeners.fetchedMessage.push(fn); }

// Ask SW to fetch a large message (returns via 'fetchedMessage' event)
export function requestFetchFromSW(fetchUrl, requestId = null) {
  if (!navigator.serviceWorker.controller) {
    console.warn('No SW controller to request fetch');
    return;
  }
  navigator.serviceWorker.controller.postMessage({ command: 'fetchMessage', data: { fetchUrl, requestId } });
}
