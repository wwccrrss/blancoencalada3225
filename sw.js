// Service Worker — Portero Digital Blanco Encalada 3225
// Versión 2 — lee el depto desde Firebase directamente

const FIREBASE_DB = 'https://blancoencalada3225-default-rtdb.firebaseio.com';

let watchInterval = null;
let lastCallId = null;
let myDepto = null;

// Instalación
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// Recibir mensajes desde la página
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'WATCH_DEPTO') {
    myDepto = parseInt(event.data.depto);
    iniciarPolling();
    // Confirmar al cliente
    event.source && event.source.postMessage({ type: 'SW_READY', depto: myDepto });
  }
});

function iniciarPolling() {
  if (watchInterval) clearInterval(watchInterval);
  if (!myDepto) return;
  
  // Verificar inmediatamente y luego cada 5 segundos
  checkForCalls();
  watchInterval = setInterval(checkForCalls, 5000);
}

function checkForCalls() {
  if (!myDepto) return;
  
  var url = FIREBASE_DB + '/calls.json?orderBy="deptoId"&equalTo=' + myDepto + '&limitToLast=3';
  
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data || typeof data !== 'object') return;
      
      var keys = Object.keys(data);
      if (keys.length === 0) return;
      
      // Buscar la llamada más reciente en estado ringing
      var ahora = Date.now();
      keys.forEach(function(callId) {
        var call = data[callId];
        if (!call) return;
        if (call.status !== 'ringing') return;
        if (callId === lastCallId) return;
        
        var edad = ahora - (call.timestamp || 0);
        if (edad > 30000) return; // ignorar llamadas viejas de más de 30s
        
        lastCallId = callId;
        mostrarNotificacion(myDepto, callId);
      });
    })
    .catch(function(e) {
      console.log('SW fetch error:', e);
    });
}

function mostrarNotificacion(depto, callId) {
  var opciones = {
    body: 'Tocaron el timbre en Blanco Encalada 3225',
    icon: 'https://wwccrrss.github.io/blancoencalada3225/icon-192.png',
    badge: 'https://wwccrrss.github.io/blancoencalada3225/icon-192.png',
    vibrate: [300, 100, 300, 100, 300, 100, 300],
    requireInteraction: true,
    tag: 'llamada',
    renotify: true,
    data: { depto: depto, callId: callId },
    actions: [
      { action: 'atender', title: '📞 Atender' },
      { action: 'rechazar', title: '📵 Rechazar' }
    ]
  };
  
  self.registration.showNotification('🔔 Llamada — Depto ' + depto, opciones);
}

// Click en la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  var depto = event.notification.data && event.notification.data.depto;
  var callId = event.notification.data && event.notification.data.callId;
  var action = event.action;
  
  if (action === 'rechazar') {
    // Marcar como rechazada en Firebase
    fetch(FIREBASE_DB + '/calls/' + callId + '/status.json', {
      method: 'PUT',
      body: JSON.stringify('rejected')
    }).catch(function(){});
    return;
  }
  
  // Atender — abrir la app
  var url = 'https://wwccrrss.github.io/blancoencalada3225/timbre-residente.html?depto=' + depto + '&callId=' + callId;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes('timbre-residente') && 'focus' in client) {
            client.postMessage({ type: 'LLAMADA_ENTRANTE', callId: callId, depto: depto });
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
