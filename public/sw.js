const CACHE = "samjoe-static-shell-v2";
// Toda URL listada aqui precisa existir: cache.addAll rejeita em qualquer 404 e,
// com isso, a instalacao do service worker falha inteira. /apple-icon.svg foi
// removida porque o Next nao gera rota de apple-icon a partir de SVG.
const STATIC_ASSETS = ["/offline", "/icon.svg"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const path = new URL(event.request.url).pathname;
  if (STATIC_ASSETS.includes(path)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
  }
});
