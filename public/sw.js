const CACHE = "mare-alta-v2";
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  // Nunca interceptar chamadas de API — deixa passar direto pra rede,
  // sem cache, sem fallback. Isso é essencial pro salvamento funcionar.
  if (e.request.url.includes("/api/")) {
    return;
  }
  if (e.request.method !== "GET") {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
