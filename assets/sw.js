// Service Worker para Vinyl Beats Radio
// Proporciona funcionalidad offline y caché de recursos

const CACHE_NAME = 'vinyl-beats-radio-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/script.js',
  '/assets/manifest.json',
  '/assets/icons/favicon.svg',
  '/assets/OTF/ClashGrotesk-Regular.otf',
  '/assets/OTF/ClashGrotesk-Medium.otf',
  '/assets/OTF/ClashGrotesk-Semibold.otf',
  '/assets/OTF/ClashGrotesk-Bold.otf',
  '/assets/OTF/ClashGrotesk-Light.otf',
  '/assets/OTF/ClashGrotesk-Extralight.otf'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cacheando recursos estáticos');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch((err) => {
        console.warn('⚠️ Service Worker: Error al cachear recursos:', err);
      })
  );
  self.skipWaiting(); // Activar inmediatamente
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Tomar control inmediatamente
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear streams de audio (siempre usar red)
  if (url.pathname.includes('.mp3') || url.hostname.includes('stream.')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Si falla, mostrar mensaje offline
          return new Response(
            JSON.stringify({ error: 'Stream no disponible offline' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Estrategia: Cache First para recursos estáticos
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Solo cachear respuestas exitosas y del mismo origen
            if (response.status === 200 && url.origin === self.location.origin) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Si es una página HTML y está offline, servir index.html
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

