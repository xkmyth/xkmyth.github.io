/* xkmyth 全站 service worker —— 纯静态站点的离线与提速
   策略：导航请求 network-first（断网回缓存，再断回 404 页）
         静态资源 stale-while-revalidate（先给缓存，后台刷新）
         跨域与写请求一律放行，不缓存 search-index 之外的动态接口 */
const VER = 'xkmyth-2026-10-18';
const CORE = [
  '/', '/404.html', '/style.css', '/sub.css', '/sub.js', '/main.js',
  '/manifest.webmanifest', '/search-index.json',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/tools/', '/software/', '/software/app.css', '/docs/',
  '/Timarsky/', '/Timarsky/tools/', '/Timarsky/style.css',
  '/Timarsky/tools/tools.css', '/Timarsky/tools/tools.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VER).then(function (cache) {
      return Promise.all(CORE.map(function (u) {
        return cache.add(new Request(u, { cache: 'reload' })).catch(function () { /* 单个失败不影响整体 */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === VER ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VER).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/404.html') || caches.match('/');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VER).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
