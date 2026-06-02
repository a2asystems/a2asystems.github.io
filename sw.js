// A2A Systems — Service Worker v2
// Hintergrund-Sync für Chat-Nachrichten und Push-Benachrichtigungen

self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()); });

// Netzwerk-Requests durchlassen (kein aggressives Caching — Daten müssen frisch sein)
self.addEventListener('fetch', function(e) {
    var url = e.request.url;
    if (url.includes('api.github.com') || url.includes('data.json') ||
        url.includes('chat.json') || url.includes('state.json')) return;
    e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
});

// Benachrichtigung angeklickt → App öffnen
self.addEventListener('notificationclick', function(e) {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cs) {
            for (var i = 0; i < cs.length; i++) {
                if (cs[i].url.includes(self.location.origin)) { cs[i].focus(); return; }
            }
            return clients.openWindow('/');
        })
    );
});

// ── Hintergrund-Chat-Check ───────────────────────────────────────────────────
var _gu = '', _gr = '', _gt = '', _me = '', _lastTs = 0, _busy = false;

self.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'INIT') {
        _gu = e.data.gu || ''; _gr = e.data.gr || '';
        _gt = e.data.gt || ''; _me = e.data.me || '';
        _lastTs = e.data.lastTs || 0;
    }
    if (e.data.type === 'UPDATE_TS') { _lastTs = e.data.ts; }
});

async function bgCheck() {
    if (!_gu || !_gr || !_gt || _busy) return;
    _busy = true;
    try {
        var r = await fetch(
            'https://api.github.com/repos/' + _gu + '/' + _gr + '/contents/chat.json?_=' + Date.now(),
            { headers: { Authorization: 'Bearer ' + _gt, 'User-Agent': 'gold-bot', 'Cache-Control': 'no-cache' } }
        );
        if (!r.ok) return;
        var m = await r.json();
        var raw = atob(m.content.replace(/\n/g, ''));
        var msgs = JSON.parse(decodeURIComponent(escape(raw)));
        var newMsgs = msgs.filter(function(msg) { return !msg.auto && msg.ts > _lastTs && msg.author !== _me; });
        if (newMsgs.length > 0) {
            var latest = newMsgs[newMsgs.length - 1];
            var perm = self.Notification ? self.Notification.permission : 'denied';
            if (perm === 'granted') {
                await self.registration.showNotification('A2A Systems · Commander', {
                    body: (latest.author || 'Commander') + ': ' + (latest.content || '').slice(0, 100),
                    icon: '/icon-192.png',
                    badge: '/icon-72.png',
                    tag: 'a2a-chat',
                    renotify: true,
                    vibrate: [200, 100, 200],
                    data: { url: '/' }
                });
            }
            // Alle offenen Tabs informieren
            var allClients = await clients.matchAll({ type: 'window' });
            allClients.forEach(function(c) { c.postMessage({ type: 'NEW_MSGS', count: newMsgs.length }); });
            _lastTs = Math.max.apply(null, msgs.filter(function(x){ return !x.auto; }).map(function(x){ return x.ts; }));
        }
    } catch(e) {
    } finally { _busy = false; }
}

// Alle 12 Sekunden prüfen (auch wenn App im Hintergrund ist)
setInterval(bgCheck, 12000);
