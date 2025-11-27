// Service Worker para Vinyl Vibes Radio
// Proporciona funcionalidad offline y caché de recursos

// Bump cache name to force clients to pick the updated SW that bypasses streams
const CACHE_NAME = 'vinyl-vibes-radio-v4';
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
  // Usar waitUntil pero no bloquear si falla (importante para iOS)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cacheando recursos estáticos');
        // Intentar cachear, pero no fallar si algunos recursos no se pueden cachear
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(new Request(url, { cache: 'reload' }))
              .catch(err => {
                console.warn(`⚠️ No se pudo cachear ${url}:`, err);
                return null; // Continuar aunque falle
              })
          )
        );
      })
      .catch((err) => {
        console.warn('⚠️ Service Worker: Error al cachear recursos:', err);
        // No bloquear la instalación si hay errores
      })
      .then(() => {
        // Activar inmediatamente incluso si hay errores
        return self.skipWaiting();
      })
  );
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
    }).then(() => {
      // Forzar actualización en todos los clientes
      return self.clients.claim();
    })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca interceptar audio ni peticiones a otros orígenes (ej. Icecast)
  // para evitar cancelaciones o respuestas cacheadas.
  if (request.destination === 'audio' || url.hostname === 'radio.vinylvibesradio.com' || url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

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

  // Estrategia: Network First para HTML/JS/CSS (siempre obtener versión más reciente)
  // Cache First solo para fuentes e imágenes
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/html') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css')) {
    // Network First para HTML, JS y CSS
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Solo cachear respuestas exitosas y del mismo origen
          if (response.status === 200 && url.origin === self.location.origin) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(() => {
                // Silenciar errores de caché
              });
            }).catch(() => {
              // Silenciar errores de caché
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla la red, intentar desde caché
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si es HTML y no hay caché, servir index.html
            if (acceptHeader.includes('text/html')) {
              return caches.match('/index.html').then((htmlCache) => {
                if (htmlCache) {
                  return htmlCache;
                }
                // Si no hay nada en caché, intentar fetch directo (para iOS)
                return fetch(request).catch(() => {
                  return new Response('Page not available', { status: 404 });
                });
              });
            }
            // Para otros recursos, devolver error
            return new Response('Resource not available', { status: 404 });
          }).catch(() => {
            // Si todo falla, intentar fetch directo
            return fetch(request).catch(() => {
              return new Response('Resource not available', { status: 404 });
            });
          });
        })
    );
    return;
  }

  // Cache First para otros recursos (fuentes, imágenes, etc.)
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
            if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            // Si no hay respuesta, devolver error pero no bloquear
            return new Response('Resource not available', { status: 404 });
          });
      })
      .catch(() => {
        // Si todo falla, intentar fetch directo sin caché (para iOS)
        return fetch(request).catch(() => {
          return new Response('Resource not available', { status: 404 });
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
