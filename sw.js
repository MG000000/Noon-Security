// تطبيق الورديات — بيخلّي التطبيق يتسطب ويوصّل الإشعارات والتطبيق مقفول
// تمت البرمجة بواسطة MG CO
const CACHE = 'shifts-v3';
const SHELL = ['./', 'index.html', 'manifest.json', 'app-icon-192.png', 'app-icon-512.png'];
const ICON = 'app-icon-192.png';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'sr-me').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // الداتا دايمًا من النت
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});

/* ---------- الإشعارات ---------- */
async function readJSON(key, def) {
  try { const c = await caches.open('sr-me'); const r = await c.match(key); return r ? await r.json() : def; } catch (e) { return def; }
}
async function writeJSON(key, v) {
  try { const c = await caches.open('sr-me'); await c.put(key, new Response(JSON.stringify(v))); } catch (e) {}
}
function pickNotif(d, me, seen) {
  const name = id => (d.employees && d.employees[id] && d.employees[id].name) || '';
  if (me.admin) {
    const outs = [];
    const g = d.geolog || {};
    for (const day in g) for (const emp in g[day]) for (const ts in g[day][emp]) {
      const v = String(g[day][emp][ts]);
      if (v.indexOf('out') === 0 && Date.now() - Number(ts) < 30 * 60000 && !seen['g' + ts + emp]) outs.push([Number(ts), emp, v]);
    }
    if (outs.length) {
      outs.sort((a, b) => b[0] - a[0]);
      const [ts, emp, v] = outs[0];
      return { key: 'g' + ts + emp, title: '⚠ موظف خرج برا مكانه', body: `${name(emp)} برا مكان شغله بحوالي ${v.split(':')[1] || '?'} متر`, tag: 'geo-' + emp };
    }
    const reqs = Object.entries(d.requests || {}).filter(([k, r]) => r && r.status === 'pending' && !seen[k]).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    if (reqs.length) {
      const [k, r] = reqs[0];
      return { key: k, title: 'طلب جديد', body: `${name(r.emp)} طالب ${r.type === 'swap' ? 'تبديل يوم' : 'إجازة'}`, tag: 'req-' + k };
    }
    return null;
  }
  if (me.emp) {
    const reads = (d.reads && d.reads[me.emp]) || {};
    const ms = Object.entries(d.messages || {}).filter(([k, m]) => m && m.to && m.to[me.emp] && !reads[k] && !seen[k]).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    if (ms.length) {
      const [k, m] = ms[0];
      const t = (m.texts && m.texts[me.emp]) != null ? m.texts[me.emp] : (m.text || '');
      return { key: k, title: 'رسالة جديدة', body: String(t).slice(0, 180), tag: 'msg-' + k };
    }
  }
  return null;
}
async function handlePush() {
  const me = await readJSON('/__me', {});
  let title = me.brand || 'الورديات', body = 'فيه تحديث جديد، افتح التطبيق', tag = 'update';
  try {
    if (me.api) {
      const d = await (await fetch(me.api + (me.api.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now())).json();
      const seen = await readJSON('/__seen', {});
      const n = pickNotif(d, me, seen);
      if (n) {
        title = n.title; body = n.body; tag = n.tag;
        seen[n.key] = Date.now();
        const ks = Object.keys(seen); if (ks.length > 300) ks.sort((a, b) => seen[a] - seen[b]).slice(0, ks.length - 300).forEach(k => delete seen[k]);
        await writeJSON('/__seen', seen);
      }
    }
  } catch (e) {}
  await self.registration.showNotification(title, { body, tag, icon: ICON, badge: ICON, lang: 'ar', dir: 'rtl', renotify: true, vibrate: [200, 100, 200, 100, 200], data: { url: './' } });
}
self.addEventListener('push', e => { e.waitUntil(handlePush()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});