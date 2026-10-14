// =========================================================================
// SERVICE WORKER - PWA OFFLINE CACHE
// =========================================================================
const CACHE_NAME = 'arvo-mobile-v1.32';

const ASSETS_TO_CACHE = [
  '/arvocarmobile/frontendmobile/mobile.html',
  '/arvocarmobile/frontendmobile/instalar.html',
  '/arvocarmobile/frontendmobile/abastecimentomobile.html',
  '/arvocarmobile/frontendmobile/reservasmobile.html',
  '/arvocarmobile/backendmobile/mobile.js',
  '/arvocarmobile/backendmobile/abastecimentomobile.js',
  '/arvocarmobile/backendmobile/reservasmobile.js',
  '/manifest.json',
  '/imagens/logo3d192.png',
  '/imagens/logo3d512.png',
  '/imagens/arvocarblack150.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@phosphor-icons/web',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora requisições de API para o Supabase
  if (event.request.url.includes('supabase.co')) return;

  // 1. Para páginas HTML/navegação: busca primeiro na rede, cai no cache se offline (Network-First)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Grava a versão mais recente da página no cache
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          return response;
        })
        .catch(() => {
          // Se não houver rede, entrega o HTML do cache
          return caches.match(event.request).then((res) => {
            return res || caches.match('/arvocarmobile/frontendmobile/mobile.html');
          });
        })
    );
    return;
  }

  // 2. Para arquivos estáticos (ícones, logos, bibliotecas CDN): Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});