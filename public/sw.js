// Service worker mínimo: habilita a instalação como app, sem cache (evita versão velha após cada deploy).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
