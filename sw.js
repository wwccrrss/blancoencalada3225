// Service Worker — Portero Digital Blanco Encalada 3225 v3
const FIREBASE_DB = 'https://blancoencalada3225-default-rtdb.firebaseio.com';
const DEPTO_KEY = 'portero_depto';

let watchInterval = null;
let lastCallId = null;
let myDepto = null;

self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) { 
  e.waitUntil(clients.claim());
  // Arrancar polling si tenemos depto guardado
  getDeptoYArrancar();
});

// Recibir depto desde la página
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'WATCH_DEPTO') {
    myDepto = parseInt(event.data.depto);
    // Guardar en IndexedDB para persistir
    guardarDepto(myDepto);
    iniciarPolling();
  }
});

// Guardar depto en cache para persistir entre reinicios
function guardarDepto(depto) {
  caches.open('portero-config').then(function(cache) {
    cache.put('/depto', new Response(String(depto)));
  });
}

function getDeptoYArrancar() {
  caches.open('portero-config').then(function(cache) {
    cache.match('/depto').then(function(response) {
      if (response) {
        response.text().then(function(depto) {
          myDepto = parseInt(depto);
          if (myDepto) iniciarPolling();
        });
      }
    });
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
    getDeptoYArrancar();
    return;
  }
  
  var url = FIREBASE_DB + '/calls.json?orderBy="deptoId"&equalTo=' + myDepto + '&limitToLast=3';
  
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data || typeof data !== 'object') return;
      var keys = Object.keys(data);
      if (keys.length === 0) return;
      
      var ahora = Date.now();
      keys.forEach(function(callId) {
        var call = data[callId];
        if (!call) return;
        if (call.status !== 'ringing') return;
        if (callId === lastCallId) return;
        var edad = ahora - (call.timestamp || 0);
        if (edad > 35000) return;
        lastCallId = callId;
        mostrarNotificacion(myDepto, callId);
      });
    })
    .catch(function(e) {});
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
  var action = event.action;
  
  if (action === 'rechazar') {
    fetch(FIREBASE_DB + '/calls/' + callId + '/status.json', {
      method: 'PUT', body: JSON.stringify('rejected')
    }).catch(function(){});
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
