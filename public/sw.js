const CACHE = "mare-alta-v1";
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  // network-first, cai pro cache só se offline
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
