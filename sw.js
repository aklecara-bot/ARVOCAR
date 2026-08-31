// =========================================================================
// SERVICE WORKER - PWA OFFLINE CACHE
// =========================================================================
const CACHE_NAME = 'arvo-mobile-v2';

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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Não intercepta chamadas de API do Supabase no Cache Storage comum
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => caches.match(event.request));
    })
  );
});