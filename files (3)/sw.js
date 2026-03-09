// Service Worker — Portero Digital Blanco Encalada 3225
const CACHE = 'portero-v1';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkd10JiZTM2kdj6tJgssINZTzGhZq2D0Q",
  authDomain: "blancoencalada3225.firebaseapp.com",
  databaseURL: "https://blancoencalada3225-default-rtdb.firebaseio.com",
  projectId: "blancoencalada3225"
};

// Escuchar mensajes desde la página principal
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'WATCH_DEPTO') {
    watchDepto(event.data.depto);
  }
});

// Cuando se hace click en la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const depto = event.notification.data && event.notification.data.depto;
  const callId = event.notification.data && event.notification.data.callId;
  const url = self.location.origin + '/blancoencalada3225/timbre-residente.html?depto=' + depto + '&callId=' + callId + '&autoatender=1';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si ya hay una ventana abierta, enfocarla
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('timbre-residente') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Polling Firebase desde el Service Worker
let watchInterval = null;
let lastCallId = null;
let myDepto = null;

function watchDepto(depto) {
  myDepto = depto;
  if (watchInterval) clearInterval(watchInterval);
  
  // Verificar cada 5 segundos si hay llamadas nuevas
  watchInterval = setInterval(function() {
    checkForCalls(depto);
  }, 5000);
  
  // También verificar inmediatamente
  checkForCalls(depto);
}

function checkForCalls(depto) {
  var url = FIREBASE_CONFIG.databaseURL + '/calls.json?orderBy="deptoId"&equalTo=' + depto + '&limitToLast=1';
  
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data) return;
      
      var keys = Object.keys(data);
      if (keys.length === 0) return;
      
      var callId = keys[0];
      var call = data[callId];
      
      // Nueva llamada entrante
      if (call.status === 'ringing' && callId !== lastCallId) {
        var edad = Date.now() - (call.timestamp || 0);
        if (edad < 30000) { // menos de 30 segundos
          lastCallId = callId;
          mostrarNotificacion(depto, callId);
        }
      }
    })
    .catch(function(e) {});
}

function mostrarNotificacion(depto, callId) {
  self.registration.showNotification('🔔 Alguien llama al Depto ' + depto, {
    body: 'Tocaron el timbre en Blanco Encalada 3225',
    icon: '/blancoencalada3225/icon-192.png',
    badge: '/blancoencalada3225/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: 'llamada-' + callId,
    data: { depto: depto, callId: callId }
  });
}
