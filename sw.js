// Service Worker — Portero Digital Blanco Encalada 3225 v4
// Lee el depto desde Cache API (guardado por la página) y desde Firebase

const FIREBASE_DB = 'https://blancoencalada3225-default-rtdb.firebaseio.com';

let watchInterval = null;
let lastCallId = null;
let myDepto = null;

self.addEventListener('install', function(e) { self.skipWaiting(); });

self.addEventListener('activate', function(e) {
  e.waitUntil(
    clients.claim().then(function() {
      return arrancar();
    })
  );
});

// Recibir depto desde la página
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'WATCH_DEPTO') {
    myDepto = parseInt(event.data.depto);
    guardarDepto(myDepto);
    iniciarPolling();
  }
});

function guardarDepto(depto) {
  return caches.open('portero-v4').then(function(cache) {
    return cache.put('/portero-depto', new Response(String(depto)));
  });
}

function leerDepto() {
  return caches.open('portero-v4').then(function(cache) {
    return cache.match('/portero-depto').then(function(resp) {
      if (resp) return resp.text().then(function(t) { return parseInt(t) || null; });
      return null;
    });
  });
}

function arrancar() {
  return leerDepto().then(function(depto) {
    if (depto) {
      myDepto = depto;
      iniciarPolling();
    }
  });
}

function iniciarPolling() {
  if (watchInterval) clearInterval(watchInterval);
  if (!myDepto) return;
  checkForCalls();
  watchInterval = setInterval(checkForCalls, 5000);
}

function checkForCalls() {
  if (!myDepto) {
    leerDepto().then(function(d) {
      if (d) { myDepto = d; iniciarPolling(); }
    });
    return;
  }

  fetch(FIREBASE_DB + '/calls.json?orderBy="deptoId"&equalTo=' + myDepto + '&limitToLast=3')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data || typeof data !== 'object') return;
      var ahora = Date.now();
      Object.keys(data).forEach(function(callId) {
        var call = data[callId];
        if (!call || call.status !== 'ringing') return;
        if (callId === lastCallId) return;
        if (ahora - (call.timestamp || 0) > 35000) return;
        lastCallId = callId;
        mostrarNotificacion(myDepto, callId);
      });
    })
    .catch(function() {});
}

function mostrarNotificacion(depto, callId) {
  self.registration.showNotification('🔔 Llamada — Depto ' + depto, {
    body: 'Tocaron el timbre en Blanco Encalada 3225',
    icon: 'https://wwccrrss.github.io/blancoencalada3225/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
    tag: 'llamada',
    renotify: true,
    data: { depto: depto, callId: callId },
    actions: [
      { action: 'atender', title: '📞 Atender' },
      { action: 'rechazar', title: '📵 Rechazar' }
    ]
  });
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var depto = event.notification.data && event.notification.data.depto;
  var callId = event.notification.data && event.notification.data.callId;

  if (event.action === 'rechazar') {
    fetch(FIREBASE_DB + '/calls/' + callId + '/status.json', {
      method: 'PUT', body: JSON.stringify('rejected')
    }).catch(function() {});
    return;
  }

  var url = 'https://wwccrrss.github.io/blancoencalada3225/timbre-residente.html?depto=' + depto + '&callId=' + callId;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes('timbre-residente') && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
