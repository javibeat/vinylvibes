// Vinyl Vibes Radio - Interactive features
// ----------------------------------

// Debug mode - set to false in production to reduce console noise
const DEBUG = false; // Cambiar a true para ver logs detallados

// Helper para logging condicional
const log = (...args) => DEBUG && console.log(...args);
const logWarn = (...args) => DEBUG && console.warn(...args);
const logError = (...args) => console.error(...args); // Errores siempre se muestran

document.addEventListener('DOMContentLoaded', () => {
  // Prevent zoom on mobile devices (especially iOS) - Only after page loads
  (function () {
    // Only run on mobile devices to avoid blocking desktop
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    let lastTouchEnd = 0;
    let initialDistance = 0;
    let isPinching = false;

    // Prevent double-tap zoom on iOS - only on body, not on interactive elements
    document.addEventListener('touchend', function (event) {
      // Allow default behavior on inputs, buttons, links, etc.
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'A' ||
        target.closest('button') || target.closest('a') || target.closest('input')) {
        return;
      }

      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
      isPinching = false;
    }, { passive: false });

    // Prevent pinch zoom - only prevent when actually pinching
    document.addEventListener('touchstart', function (event) {
      if (event.touches.length === 2) {
        isPinching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      } else {
        isPinching = false;
      }
    }, { passive: true }); // Use passive for better performance

    document.addEventListener('touchmove', function (event) {
      if (isPinching && event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        // If pinch gesture detected, prevent default
        if (Math.abs(currentDistance - initialDistance) > 5) {
          event.preventDefault();
        }
      }
    }, { passive: false });

    // Prevent pinch zoom on iOS (Gesture Events)
    document.addEventListener('gesturestart', function (e) {
      e.preventDefault();
    });
    document.addEventListener('gesturechange', function (e) {
      e.preventDefault();
    });
    document.addEventListener('gestureend', function (e) {
      e.preventDefault();
    });
  })();

  // Theme management
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const html = document.documentElement;

  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // Theme toggle handler
  themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });

  function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // Quality management
  const qualityToggle = document.getElementById('qualityToggle');
  const qualityValue = document.getElementById('qualityValue');
  let currentQuality = parseInt(localStorage.getItem('audioQuality')) || 192; // Default to 192 kbps for better stability

  // Update quality display
  function updateQualityDisplay() {
    qualityValue.textContent = currentQuality;
    localStorage.setItem('audioQuality', currentQuality.toString());
  }

  // Initialize quality display
  updateQualityDisplay();

  // Quality toggle handler
  qualityToggle.addEventListener('click', () => {
    currentQuality = currentQuality === 320 ? 192 : 320;
    updateQualityDisplay();

    // If a station is currently playing, switch to new quality
    if (currentStation && audioPlayer.src) {
      switchStation(currentStation, true);
    }
  });

  // Build stream URL
  function buildStreamUrl(baseUrl, mountName, quality) {
    // Mounts format: /mountname320 or /mountname192
    // Example: /jazzy320 or /jazzy192
    const mount = `${mountName}${quality}`;
    return `${baseUrl}/${mount}`;
  }

  // Test if stream URL is accessible (silent test, no console warnings)
  async function testStreamUrl(url) {
    return new Promise((resolve) => {
      const testAudio = new Audio();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          testAudio.src = '';
          // Silent timeout - streams can take time to respond
          resolve(false);
        }
      }, 10000); // 10 second timeout (increased for slow connections)

      testAudio.addEventListener('canplay', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testAudio.src = '';
          // Only log success, not failures (to reduce console noise)
          resolve(true);
        }
      });

      testAudio.addEventListener('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testAudio.src = '';
          // Silent error - stream test is non-critical
          resolve(false);
        }
      });

      testAudio.src = url;
      testAudio.load();
    });
  }

  // Fade-in effect on page load
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });

  // Background playback support - Update Media Session
  function updateMediaSession(stationName) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: stationName,
        artist: 'Vinyl Vibes Radio',
        album: 'Pure House Music 24/7',
        artwork: [
          { src: '/assets/icons/favicon.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      });
    }
  }

  // Keep audio playing when page is hidden (background playback)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audioPlayer.paused && localStorage.getItem('wasPlaying') === 'true') {
      // Page became visible again, resume if it was playing
      const favoriteStationId = getFavoriteStation();
      if (currentStation === favoriteStationId) {
        audioPlayer.play().catch(err => {
          console.log('Auto-resume prevented');
        });
      }
    }
  });

  // Station management
  const stationButtons = document.querySelectorAll('.station-btn');
  const audioPlayer = document.getElementById('audioPlayer');
  const currentStationDisplay = document.getElementById('currentStation');
  const trackNameDisplay = document.getElementById('trackName');
  const playerStatusDisplay = document.getElementById('playerStatus');
  const streamStatusDisplay = document.getElementById('streamStatus');
  const trackArtwork = document.getElementById('trackArtwork');
  const artworkPlaceholder = document.getElementById('artworkPlaceholder');

  let currentStation = null;
  let currentBaseUrl = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10; // Aumentado para más intentos
  let reconnectTimeout = null;
  let trackInfoInterval = null;
  let stalledTimeout = null;
  let isReconnecting = false;
  let bufferCheckInterval = null;
  let heartbeatInterval = null;
  let lastBufferTime = 0;
  let lastPlayTime = 0;
  let networkQuality = 'good'; // 'good', 'slow', 'offline'

  // Update player display
  function updatePlayerDisplay(stationName, status, streamInfo = '') {
    if (currentStationDisplay) {
      currentStationDisplay.textContent = stationName;
    }
    if (playerStatusDisplay) {
      playerStatusDisplay.textContent = status;
    }
    if (streamStatusDisplay) {
      streamStatusDisplay.textContent = streamInfo;
      streamStatusDisplay.className = 'stream-status ' + (streamInfo ? 'visible' : '');
    }
  }

  // Update track info with metadata from stream
  function updateTrackInfo(stationName, trackTitle = null, artworkUrl = null) {
    // Update track name
    if (trackNameDisplay) {
      if (trackTitle && trackTitle.trim() !== '') {
        trackNameDisplay.textContent = trackTitle;
      } else {
        trackNameDisplay.textContent = `Now playing on ${stationName}`;
      }
    }

    // Update artwork
    if (artworkUrl && artworkUrl.trim() !== '') {
      if (trackArtwork) {
        trackArtwork.src = artworkUrl;
        trackArtwork.style.display = 'block';
        trackArtwork.onerror = () => {
          // If image fails to load, show placeholder
          trackArtwork.style.display = 'none';
          if (artworkPlaceholder) {
            artworkPlaceholder.style.display = 'flex';
          }
        };
      }
      if (artworkPlaceholder) {
        artworkPlaceholder.style.display = 'none';
      }
    } else {
      // Show placeholder if no artwork
      if (artworkPlaceholder) {
        artworkPlaceholder.style.display = 'flex';
      }
      if (trackArtwork) {
        trackArtwork.style.display = 'none';
      }
    }
  }

  // Extract metadata from audio element (if available)
  function extractMetadataFromAudio() {
    if (!audioPlayer || !audioPlayer.src) return null;

    try {
      // Try to get metadata from the audio element
      // Note: Browsers have limited support for reading ID3 tags from streams
      // We'll use the metadataupdate event if available
      return null; // Will be populated by metadataupdate event
    } catch (e) {
      console.warn('Could not extract metadata from audio:', e);
      return null;
    }
  }

  // Fetch artwork from external API based on track title
  async function fetchArtworkFromAPI(trackTitle, artist = null) {
    if (!trackTitle || trackTitle.trim() === '') return null;

    try {
      // Try Last.fm API (free, no key required for basic usage)
      const searchQuery = artist ? `${artist} ${trackTitle}` : trackTitle;
      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(searchQuery)}&api_key=YOUR_API_KEY&format=json`, {
        mode: 'cors'
      });

      // For now, return null - we'll use a simpler approach
      return null;
    } catch (e) {
      console.warn('Could not fetch artwork from API:', e);
      return null;
    }
  }

  // Fetch track info from Icecast stats endpoint
  async function fetchTrackInfo(baseUrl, mountName) {
    try {
      const mount = `${mountName}${currentQuality}`;
      const statsUrl = `${baseUrl}/admin/stats.xml`;

      const response = await fetch(statsUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': 'Basic ' + btoa('admin:vinyl2024')
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Stats endpoint returned ${response.status}`);
        return null;
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Find the source element for our mount
      const sources = xmlDoc.getElementsByTagName('source');
      for (let source of sources) {
        const mountAttr = source.getAttribute('mount');
        if (mountAttr === `/${mount}`) {
          const titleElement = source.getElementsByTagName('title')[0];
          if (titleElement && titleElement.textContent) {
            const trackTitle = titleElement.textContent.trim();
            console.log(`🎵 Metadata from Icecast: ${trackTitle}`);
            return { title: trackTitle };
          }
        }
      }

      return null;
    } catch (e) {
      console.warn('Could not fetch track info from Icecast:', e);
      return null;
    }
  }

  // Optimized buffer monitoring - ULTRA OPTIMIZADO
  function startBufferMonitoring() {
    if (bufferCheckInterval) {
      clearInterval(bufferCheckInterval);
    }

    bufferCheckInterval = setInterval(() => {
      if (!audioPlayer || !audioPlayer.src || audioPlayer.paused) return;

      // Check buffer health
      if (audioPlayer.buffered.length > 0) {
        const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
        const currentTime = audioPlayer.currentTime;
        const bufferAhead = bufferedEnd - currentTime;
        
        // Log detallado si el buffer es muy bajo mientras está reproduciéndose
        // Solo loggear cada 5 segundos para evitar spam en consola
        if (bufferAhead < 1 && !audioPlayer.paused) {
          const now = Date.now();
          if (!window.lastBufferWarning || (now - window.lastBufferWarning) > 5000) {
            log(`⚠️ Buffer crítico durante reproducción: ${bufferAhead.toFixed(2)}s - ReadyState: ${audioPlayer.readyState}, NetworkState: ${audioPlayer.networkState}`);
            window.lastBufferWarning = now;
          }
        }

        // Buffer monitoring - solo monitorear, NUNCA reconectar por buffer bajo
        // El buffer bajo es normal en streams y se recupera automáticamente
        if (bufferAhead < 10 && bufferAhead > 0) {
          // Solo loggear si es realmente crítico (< 1s) - pero NUNCA reconectar
          if (bufferAhead < 1) {
            // Log silencioso - no hacer nada, solo monitorear
            // El stream se recuperará automáticamente si hay datos disponibles
          }
        }

        // Track buffer time for network quality detection
        lastBufferTime = bufferAhead;
        
        // Actualizar último tiempo de reproducción para heartbeat
        if (!audioPlayer.paused && audioPlayer.currentTime > 0) {
          lastPlayTime = Date.now();
        }
      }

      // Monitor network state - más tolerante y solo cuando realmente hay problema
      // networkState 2 = NETWORK_IDLE (esperando datos), 3 = NETWORK_NO_SOURCE (sin fuente)
      // Solo considerar error si readyState es 0 (no hay información) y está intentando reproducir
      if (audioPlayer.networkState === 3 && audioPlayer.readyState === 0 && !audioPlayer.paused) {
        // Realmente no hay fuente - solo entonces reconectar
        if (!isReconnecting) {
          logWarn('⚠️ Network issue detected, attempting recovery...');
          attemptReconnection();
        }
      }
      
      // Verificar si el audio se detuvo inesperadamente (más agresivo)
      if (!audioPlayer.paused && audioPlayer.ended) {
        const playDuration = Date.now() - (window.streamStartTime || Date.now());
        log(`🔄 Stream ended inesperadamente después de ${(playDuration/1000).toFixed(1)}s, recargando...`);
        
        // Si el stream terminó muy rápido (< 10s), probablemente es Cloudflare
        if (playDuration < 10000 && !isReconnecting) {
          logWarn('⚠️ Stream cancelado muy rápido, probablemente Cloudflare. Reconectando...');
          attemptReconnection();
        } else {
          // Intentar recargar el stream
          audioPlayer.load();
          setTimeout(() => {
            if (!audioPlayer.paused && !isReconnecting) {
              audioPlayer.play().catch(() => {});
            }
          }, 500);
        }
      }
      
      // Verificar si el audio está pausado pero debería estar reproduciéndose
      if (audioPlayer.paused && audioPlayer.readyState >= 2 && bufferAhead > 3) {
        // El buffer es bueno pero está pausado - puede ser un problema
        // Solo intentar play si no hay interacción del usuario reciente
        const timeSinceLastInteraction = Date.now() - (window.lastUserInteraction || 0);
        if (timeSinceLastInteraction > 5000) {
          // No ha habido interacción del usuario en 5 segundos, intentar reanudar
          audioPlayer.play().catch(() => {
            // Silenciar error - puede ser política del navegador
          });
        }
      }
    }, 1000); // Check every 1 second for faster response
  }

  function stopBufferMonitoring() {
    if (bufferCheckInterval) {
      clearInterval(bufferCheckInterval);
      bufferCheckInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  // Heartbeat para detectar cancelaciones de Cloudflare antes de que el navegador las detecte
  function startHeartbeatMonitoring() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    heartbeatInterval = setInterval(() => {
      if (!audioPlayer || !audioPlayer.src || audioPlayer.paused || isReconnecting) {
        return;
      }

      // Verificar si el stream está realmente reproduciéndose
      const currentTime = audioPlayer.currentTime;
      const now = Date.now();
      const timeSinceLastPlay = now - lastPlayTime;
      
      // Si el currentTime no ha avanzado en 2 segundos y no hay buffer, probablemente Cloudflare canceló
      // Reducido de 3s a 2s para detectar cancelaciones más rápido
      if (timeSinceLastPlay > 2000 && currentTime > 0) {
        // Verificar si hay buffer disponible
        let bufferAhead = 0;
        if (audioPlayer.buffered.length > 0) {
          const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
          bufferAhead = bufferedEnd - currentTime;
        }
        
        // Si no hay buffer y el tiempo no avanza, probablemente Cloudflare canceló
        if (bufferAhead < 0.5 && audioPlayer.readyState < 3 && !audioPlayer.ended) {
          logWarn('⚠️ Heartbeat: Stream parece estar congelado (Cloudflare?). Reconectando...');
          attemptReconnection();
        }
      }
      
      // Actualizar lastPlayTime si el stream está avanzando
      if (currentTime > 0 && !audioPlayer.ended) {
        lastPlayTime = now;
      }
    }, 1000); // Verificar cada 1 segundo para detectar problemas más rápido
  }

  // Improved reconnection function
  function attemptReconnection() {
    if (isReconnecting || audioPlayer.paused) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
      updatePlayerDisplay(
        currentStationDisplay ? currentStationDisplay.textContent : 'Unknown',
        'Error',
        'Problema de conexión - Intenta recargar'
      );
      return;
    }

    isReconnecting = true;
    reconnectAttempts++;

    // Clear any existing timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Unknown';
    updatePlayerDisplay(stationName, 'Reconectando...', `Intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    // Exponential backoff: 0s (inmediato), 0.5s, 1s, 2s, etc. (max 3s para respuesta más rápida)
    // Primer intento es inmediato, luego backoff exponencial
    const delay = reconnectAttempts === 1 ? 0 : Math.min(500 * Math.pow(2, reconnectAttempts - 2), 3000);

    reconnectTimeout = setTimeout(() => {
      if (audioPlayer.paused || !currentStation) {
        isReconnecting = false;
        return;
      }

          log(`🔄 Intento de reconexión ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);

      // Cuando Cloudflare cancela, el stream está "ended" - necesitamos recargarlo completamente
      const currentSrc = audioPlayer.src;
      if (currentSrc) {
        // Si el stream terminó (ended), recargarlo completamente
        if (audioPlayer.ended) {
          log('🔄 Stream cancelado por Cloudflare, recargando completamente...');
          // Limpiar y recargar el stream
          audioPlayer.src = '';
          audioPlayer.load();
          
          // Establecer la fuente nuevamente
          setTimeout(() => {
            audioPlayer.src = currentSrc;
            audioPlayer.load();
            
            // Intentar reproducir después de que el stream esté listo
            const tryPlay = () => {
              if (audioPlayer.readyState >= 1) {
                audioPlayer.play().then(() => {
                  log('✅ Reconexión exitosa después de recarga completa');
                  isReconnecting = false;
                  reconnectAttempts = 0;
                  updatePlayerDisplay(stationName, 'Playing', `Quality: ${currentQuality} kbps`);
                }).catch(() => {
                  isReconnecting = false;
                });
              } else {
                // Esperar un poco más
                setTimeout(tryPlay, 200);
              }
            };
            
            // Intentar reproducir después de 500ms
            setTimeout(tryPlay, 500);
          }, 100);
        } else if (audioPlayer.paused) {
          // Si está pausado pero no terminado, intentar reproducir
          audioPlayer.play().then(() => {
            log('✅ Reconexión exitosa');
            isReconnecting = false;
            reconnectAttempts = 0;
            updatePlayerDisplay(stationName, 'Playing', `Quality: ${currentQuality} kbps`);
          }).catch(() => {
            // Si falla, recargar el stream
            audioPlayer.load();
            setTimeout(() => {
              if (!audioPlayer.paused) {
                audioPlayer.play().then(() => {
                  log('✅ Reconexión exitosa después de reload');
                  isReconnecting = false;
                  reconnectAttempts = 0;
                }).catch(() => {
                  isReconnecting = false;
                });
              } else {
                isReconnecting = false;
              }
            }, 1000);
          });
        } else {
          // Si está reproduciéndose, solo esperar a que se recupere
          isReconnecting = false;
        }
      } else {
        // No source, try to switch station again
        if (currentStation) {
          switchStation(currentStation, true);
        }
        isReconnecting = false;
      }
    }, delay);
  }

  // Switch station
  function switchStation(stationId, keepPlaying = false) {
    const button = document.querySelector(`[data-station="${stationId}"]`);
    if (!button) {
      console.error('Station button not found:', stationId);
      return;
    }

    const baseUrl = button.getAttribute('data-base-url');
    const mountName = button.getAttribute('data-mount');
    const stationName = button.querySelector('.station-name').textContent;
    const streamUrl = buildStreamUrl(baseUrl, mountName, currentQuality);

    // Reset reconnection state
    reconnectAttempts = 0;
    isReconnecting = false;
    networkQuality = 'good';

    // Clear any pending reconnection
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Stop buffer monitoring temporarily
    stopBufferMonitoring();

    // Stop current playback smoothly
    if (!audioPlayer.paused) {
      audioPlayer.pause();
    }

    // Update active state
    stationButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update display
    updatePlayerDisplay(stationName, 'Loading...', `Quality: ${currentQuality} kbps`);
    updateTrackInfo(stationName);

    // Update media session for background playback
    updateMediaSession(stationName);

    // Set new source
    currentStation = stationId;
    currentBaseUrl = baseUrl;

    // Set the source directly
    log(`🔗 Setting audio source to: ${streamUrl}`);
    
    // Configure audio player for optimal streaming
    // Para streams, usar 'none' es mejor para carga más rápida
    audioPlayer.preload = 'none';
    
    // Limpiar fuente anterior antes de establecer nueva
    audioPlayer.src = '';
    audioPlayer.load();
    
    // Establecer nueva fuente inmediatamente
    audioPlayer.src = streamUrl;
    
    // Load the stream immediately (sin setTimeout para carga más rápida)
    updatePlayerDisplay(stationName, 'Loading...', `Quality: ${currentQuality} kbps`);
    audioPlayer.load();

    // Timeout máximo para evitar quedarse en "loading" indefinidamente (reducido a 3s para respuesta más rápida)
    let loadingTimeout = setTimeout(() => {
      if (audioPlayer.readyState === 0) {
        logWarn('⚠️ Stream tardando en cargar, forzando estado Ready');
        updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps - Click play`);
      }
    }, 3000); // 3 segundos máximo (reducido de 5s)

    // Limpiar timeout cuando el stream esté listo
    const clearLoadingTimeout = () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }
    };

    // Start buffer monitoring
    startBufferMonitoring();

    // Try to play if shouldAutoPlay is true
    if (keepPlaying) {
      // Wait for stream to be ready before attempting play
      let playAttempted = false;
      const attemptPlay = () => {
        if (playAttempted && audioPlayer.readyState < 2) return;

          if (audioPlayer.readyState >= 1) {
            clearLoadingTimeout();
            if (!playAttempted) {
              playAttempted = true;
              log(`▶️ Attempting to auto-play...`);
            }
            
            audioPlayer.play().then(() => {
              log('✅ Auto-play successful');
              reconnectAttempts = 0; // Reset on successful play
              clearLoadingTimeout();
            }).catch(err => {
              clearLoadingTimeout();
              if (err.name !== 'NotAllowedError') {
                logWarn('⚠️ Auto-play prevented:', err.name, err.message);
              } else {
                log('⚠️ Auto-play requires user interaction');
              }
              updatePlayerDisplay(stationName, 'Ready', 'Click play to start');
              playAttempted = false; // Allow retry
            });
        } else {
          // Stream not ready yet, wait a bit more
          setTimeout(attemptPlay, 100);
        }
      };

      // Try multiple times with different delays for better reliability
      setTimeout(attemptPlay, 200);
      setTimeout(attemptPlay, 500);
      setTimeout(attemptPlay, 1000);
      setTimeout(attemptPlay, 2000);

      // Also listen to ready events
      ['canplay', 'loadeddata', 'canplaythrough'].forEach(eventName => {
        audioPlayer.addEventListener(eventName, () => {
          clearLoadingTimeout();
          attemptPlay();
        }, { once: true });
      });
    } else {
      // Listen for ready events to clear timeout
      ['canplay', 'loadeddata', 'canplaythrough'].forEach(eventName => {
        audioPlayer.addEventListener(eventName, () => {
          clearLoadingTimeout();
          updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps - Click play`);
        }, { once: true });
      });
        log(`⏸️ Stream loaded, waiting for user to click play`);
    }

    // Track info will be updated via metadata events
    updateTrackInfo(stationName);

    // Metadata polling DISABLED - /admin/stats.xml endpoint blocked by Cloudflare (502)
    // Track info will rely on ICY metadata from stream (if available)
    if (trackInfoInterval) {
      clearInterval(trackInfoInterval);
      trackInfoInterval = null;
    }

    log(`✅ Switched to ${stationName} - ${currentQuality} kbps`);
  }

  // Station button handlers
  stationButtons.forEach(button => {
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const stationId = button.getAttribute('data-station');
      const stationName = button.querySelector('.station-name').textContent;

      console.log(`🖱️ Click detected on: ${stationName} (ID: ${stationId})`);

      if (!stationId) {
        console.error('❌ No station ID found on button');
        return;
      }

      // Check if it's a double-click or long-press to set as favorite
      const clickTime = Date.now();
      const lastClick = button.dataset.lastClick || 0;
      const timeDiff = clickTime - lastClick;

      if (timeDiff < 500 && timeDiff > 0) {
        // Double-click detected - set as favorite
        setFavoriteStation(stationId);
        console.log(`⭐ ${stationName} marcada como favorita`);
        updatePlayerDisplay(stationName, 'Playing', '⭐ Favorita');
        return;
      }

      button.dataset.lastClick = clickTime;

      // Save favorite when switching stations
      setFavoriteStation(stationId);
      // Auto-play when switching stations
      switchStation(stationId, true);
    });
  });

  // Favorite station management
  function getFavoriteStation() {
    return localStorage.getItem('favoriteStation') || 'deep';
  }

  function setFavoriteStation(stationId) {
    localStorage.setItem('favoriteStation', stationId);
    // Update UI to show favorite
    stationButtons.forEach(btn => {
      btn.classList.remove('favorite');
      if (btn.getAttribute('data-station') === stationId) {
        btn.classList.add('favorite');
      }
    });
  }

  // Set initial station - use favorite if available
  const favoriteStationId = getFavoriteStation();
  let initialStation = document.querySelector(`[data-station="${favoriteStationId}"]`);

  // If favorite station button exists, use it; otherwise use the active one
  if (!initialStation) {
    initialStation = document.querySelector('.station-btn.active');
  }

  if (initialStation) {
    const stationId = initialStation.getAttribute('data-station');
    const stationName = initialStation.querySelector('.station-name').textContent;
    currentStation = stationId;
    currentBaseUrl = initialStation.getAttribute('data-base-url');

    // Update active state
    stationButtons.forEach(btn => btn.classList.remove('active'));
    initialStation.classList.add('active');

    // Mark favorite
    if (stationId === favoriteStationId) {
      initialStation.classList.add('favorite');
    }

    console.log(`🎯 Initial station: ${stationName} (ID: ${stationId})`);

    // Load initial station WITHOUT auto-play (user must click play or select a station)
    setTimeout(() => {
      switchStation(stationId, false); // false = no auto-play on page load
    }, 100);
  }

  // Network status monitoring
  window.addEventListener('online', () => {
    console.log('✅ Connection restored');
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    updatePlayerDisplay(stationName, playerStatusDisplay.textContent, 'Connection restored');
  });

  window.addEventListener('offline', () => {
    console.warn('⚠️ No connection');
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    updatePlayerDisplay(stationName, 'Offline', 'No internet connection');
  });

  // Player control
  if (audioPlayer) {
    audioPlayer.addEventListener('play', () => {
      // console.log('🎵 Playback started');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Playing', `Quality: ${currentQuality} kbps`);
    });

    audioPlayer.addEventListener('pause', () => {
      // console.log('⏸️ Playback paused');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Paused', '');

      // Update play button icon
      if (customPlayBtn) {
        customPlayBtn.classList.remove('playing');
      }
    });

    audioPlayer.addEventListener('playing', () => {
      if (stalledTimeout) {
        clearTimeout(stalledTimeout);
        stalledTimeout = null;
      }
      reconnectAttempts = 0; // Reset on successful play

      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Playing', `Quality: ${currentQuality} kbps`);
    });
  }

  audioPlayer.addEventListener('error', (e) => {
    const error = audioPlayer.error;
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    const currentUrl = audioPlayer.src;

    console.error('❌ Stream error detected');
    console.error('Error code:', error ? error.code : 'Unknown');
    console.error('Error message:', error ? error.message : 'No error object');
    console.error('Current URL:', currentUrl);
    console.error('Network state:', audioPlayer.networkState);
    console.error('Ready state:', audioPlayer.readyState);

    if (error) {
      let errorMessage = '';
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Connection cancelled';
          updatePlayerDisplay(stationName, 'Aborted', errorMessage);
          console.warn('⚠️ Media error: Aborted');
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error - Reconectando automáticamente...';
          updatePlayerDisplay(stationName, 'Network Error', errorMessage);
          // Intentar reconexión solo si no está ya reconectando
          if (currentUrl && !isReconnecting) {
            // Esperar un momento antes de reconectar
            setTimeout(() => {
              if (!isReconnecting) {
                attemptReconnection();
              }
            }, 2000);
          }
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Error decoding stream - Invalid format';
          updatePlayerDisplay(stationName, 'Decode Error', errorMessage);
          console.warn('⚠️ Media error: Decode');
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Stream unavailable - Intentando reconectar...';
          updatePlayerDisplay(stationName, 'Reconectando...', errorMessage);
          // Intentar reconexión solo si no está ya reconectando
          if (currentUrl && !isReconnecting) {
            // Esperar un momento antes de reconectar para evitar loops
            setTimeout(() => {
              if (!isReconnecting) {
                attemptReconnection();
              }
            }, 2000);
          }
          break;
        default:
          errorMessage = 'Unknown error - Check console for details';
          updatePlayerDisplay(stationName, 'Error', errorMessage);
          console.warn('⚠️ Media error: Unknown');
      }
    } else {
      console.warn('⚠️ Error event fired but no error object');
      updatePlayerDisplay(stationName, 'Error', 'Stream error - Check console');
    }
  });

  // Improved error handling - use the new attemptReconnection function
  audioPlayer.addEventListener('error', (e) => {
    const error = audioPlayer.error;
    if (error && error.code === MediaError.MEDIA_ERR_NETWORK && !isReconnecting) {
      console.warn('⚠️ Network error detected');
      attemptReconnection();
    }
  });

    // Reset reconnection flag when stream starts playing successfully
    audioPlayer.addEventListener('playing', () => {
      // Registrar tiempo de inicio del stream para diagnosticar cancelaciones
      window.streamStartTime = Date.now();
      
      if (isReconnecting) {
        console.log('✅ Stream reconnected successfully');
        isReconnecting = false;
        reconnectAttempts = 0; // Reset attempts on successful play
        networkQuality = 'good';
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      }
      
      // Clear stalled timeout when playing
      if (stalledTimeout) {
        clearTimeout(stalledTimeout);
        stalledTimeout = null;
      }
      
      // Ensure buffer monitoring is running
      if (!bufferCheckInterval) {
        startBufferMonitoring();
      }
      
      // Start heartbeat monitoring
      if (!heartbeatInterval) {
        startHeartbeatMonitoring();
      }
      
      // Actualizar lastPlayTime cuando empieza a reproducir
      lastPlayTime = Date.now();
    });

  audioPlayer.addEventListener('waiting', () => {
    console.log('⏳ Waiting event fired - buffer agotado');
    console.log(`📊 Waiting - ReadyState: ${audioPlayer.readyState}, NetworkState: ${audioPlayer.networkState}`);
    
    // Only show buffering message if not paused by user
    if (audioPlayer.paused) return;

    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    updatePlayerDisplay(stationName, 'Buffering...', 'Cargando stream...');

    // Clear any stalled timeout
    if (stalledTimeout) {
      clearTimeout(stalledTimeout);
    }

    // If waiting for more than 10 seconds, try to recover (aumentado de 5s a 10s)
    stalledTimeout = setTimeout(() => {
      if (audioPlayer.paused || !audioPlayer.src) return;

      // Check if we're really stalled
      if (audioPlayer.readyState < 2 && audioPlayer.networkState === 3) {
        // Solo si realmente no hay fuente (networkState 3) y no hay datos (readyState < 2)
        console.warn('⚠️ Stream stalled, attempting recovery...');
        // Try to reload solo si realmente está estancado
        audioPlayer.load();
        if (!audioPlayer.paused) {
          setTimeout(() => {
            audioPlayer.play().catch(() => {
              // If play fails, try reconnection solo si no está ya reconectando
              if (!isReconnecting) {
                attemptReconnection();
              }
            });
          }, 1000);
        }
      } else if (audioPlayer.readyState >= 2) {
        // Stream is ready, just try to play
        audioPlayer.play().catch(() => {
          // Play might be blocked, that's OK
        });
      }
      // Si readyState >= 1 pero < 2, esperar más - el stream está cargando
    }, 10000); // Aumentado a 10 segundos
  });

  // Optimized buffer handling - monitor buffer health
  audioPlayer.addEventListener('progress', () => {
    // Stream is downloading data - check buffer health
    if (audioPlayer.buffered.length > 0) {
      const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
      const currentTime = audioPlayer.currentTime;
      const bufferAhead = bufferedEnd - currentTime;

      // Update network quality based on buffer
      if (bufferAhead > 10) {
        networkQuality = 'good';
      } else if (bufferAhead > 3) {
        networkQuality = 'slow';
      } else if (bufferAhead < 1) {
        networkQuality = 'offline';
      }

      // If buffer is healthy (> 5 seconds), ensure playback continues
      if (bufferAhead > 5 && audioPlayer.paused && !audioPlayer.ended && !isReconnecting) {
        audioPlayer.play().catch(() => {
          // Play might be blocked, that's OK
        });
      }

      // Clear stalled timeout if buffer is good
      if (bufferAhead > 3 && stalledTimeout) {
        clearTimeout(stalledTimeout);
        stalledTimeout = null;
      }
    }
  });

  audioPlayer.addEventListener('loadstart', () => {
    console.log('📡 Loading stream...');
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    updatePlayerDisplay(stationName, 'Loading...', 'Connecting to stream...');
  });

  audioPlayer.addEventListener('loadedmetadata', () => {
    // console.log('✅ Stream metadata loaded');
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps`);

    // Try to extract metadata if available
    // extractMetadataFromAudio(); // Moved to 'playing' event
  });

  // Listen for metadata updates (when track changes in stream)
  audioPlayer.addEventListener('loadeddata', () => {
    // Metadata might be available now
    if (audioPlayer.textTracks && audioPlayer.textTracks.length > 0) {
      // console.log(`📝 Text tracks available: ${audioPlayer.textTracks.length}`);
      // Immediately try to setup metadata tracking
      setupMetadataTracking();
    }
  });

  // Listen for ICY metadata updates from Icecast stream
  // Icecast sends metadata via ICY protocol, which browsers expose through textTracks
  let metadataTrackingSetup = false;

  function setupMetadataTracking() {
    if (metadataTrackingSetup) {
      console.log('📝 Metadata tracking already setup, skipping...');
      return;
    }

    // console.log('🔍 Setting up metadata tracking...');

    // Method 1: Listen for textTracks when they become available
    if (audioPlayer.textTracks && audioPlayer.textTracks.length > 0) {
      // console.log(`📝 Found ${audioPlayer.textTracks.length} text tracks`);

      for (let i = 0; i < audioPlayer.textTracks.length; i++) {
        const track = audioPlayer.textTracks[i];
        // console.log(`📝 Track ${i}: kind=${track.kind}, label=${track.label}, mode=${track.mode}`);

        // Try ALL tracks, not just metadata (some browsers use different kinds)
        if (track.kind === 'metadata' || track.kind === 'subtitles' || track.kind === 'chapters' || track.label === '') {
          // Enable the track
          if (track.mode === 'disabled') {
            track.mode = 'hidden';
          }

          // Function to process cues
          const processCues = () => {
            if (track.activeCues && track.activeCues.length > 0) {
              for (let j = 0; j < track.activeCues.length; j++) {
                const cue = track.activeCues[j];
                const metadataText = cue.text || '';

                if (metadataText.trim() === '') continue;

                console.log(`📝 Cue ${j} from track ${i}:`, metadataText.substring(0, 100));

                try {
                  // Try different parsing methods
                  let trackTitle = null;

                  // Method 1: Standard ICY format
                  const titleMatch = metadataText.match(/StreamTitle=['"]([^'"]+)['"]/);
                  if (titleMatch && titleMatch[1]) {
                    trackTitle = titleMatch[1].trim();
                  }

                  // Method 2: Try without quotes
                  if (!trackTitle) {
                    const titleMatch2 = metadataText.match(/StreamTitle=([^;]+)/);
                    if (titleMatch2 && titleMatch2[1]) {
                      trackTitle = titleMatch2[1].trim().replace(/^['"]|['"]$/g, '');
                    }
                  }

                  // Method 3: Try JSON format
                  if (!trackTitle) {
                    try {
                      const jsonData = JSON.parse(metadataText);
                      trackTitle = jsonData.StreamTitle || jsonData.title || jsonData.song || null;
                    } catch (e) {
                      // Not JSON, continue
                    }
                  }

                  // Method 4: Try plain text (if it looks like a title)
                  if (!trackTitle && metadataText.trim() !== '' && metadataText.length < 200) {
                    trackTitle = metadataText.trim();
                  }

                  if (trackTitle && trackTitle !== 'Unknown Track' && trackTitle.length > 0 && trackTitle !== stationName) {
                    console.log('🎵 Track metadata received:', trackTitle);
                    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Unknown';
                    updateTrackInfo(stationName, trackTitle);
                    metadataTrackingSetup = true; // Mark as setup
                    return; // Exit once we found valid metadata
                  }
                } catch (e) {
                  console.warn('⚠️ Error parsing metadata:', e);
                }
              }
            }
          };

          // Listen for cue changes
          track.addEventListener('cuechange', processCues);

          // Force check cues periodically since cuechange may not fire reliably
          const cueCheckInterval = setInterval(() => {
            if (track.activeCues && track.activeCues.length > 0) {
              processCues();
              clearInterval(cueCheckInterval); // Stop checking once we get metadata
            }
          }, 1000);

          // Stop checking after 30 seconds
          setTimeout(() => clearInterval(cueCheckInterval), 30000);

          // Also check immediately if cues are already available
          setTimeout(processCues, 500);
          setTimeout(processCues, 2000);
          setTimeout(processCues, 5000);
        }
      }
    } else {
      // console.log('📝 No text tracks found yet, will retry...');
    }

    // Method 2: Listen for new tracks being added
    if (audioPlayer.textTracks) {
      audioPlayer.textTracks.addEventListener('addtrack', (event) => {
        const track = event.track;
        // console.log(`📝 New track added: ${track.kind} – "${track.label}" – "${track.language}"`);
        if (track.mode === 'disabled') {
          track.mode = 'hidden';
        }
        track.addEventListener('cuechange', () => {
          if (track.activeCues && track.activeCues.length > 0) {
            const cue = track.activeCues[0];
            const metadataText = cue.text || '';
            const titleMatch = metadataText.match(/StreamTitle=['"]([^'"]+)['"]/);
            if (titleMatch && titleMatch[1]) {
              const trackTitle = titleMatch[1].trim();
              console.log('🎵 Track metadata received (new track):', trackTitle);
              const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Unknown';
              updateTrackInfo(stationName, trackTitle);
            }
          }
        });
      });
    }
  }

  // Setup metadata tracking when stream loads - optimized to avoid too many calls
  // Simplified metadata tracking - only attempt once when stream loads
  audioPlayer.addEventListener('loadeddata', () => {
    if (metadataTrackingSetup) return;
    setTimeout(setupMetadataTracking, 1000);
  });

  // Metadata will be fetched from /admin/stats.xml endpoint instead
  // Removed HEAD request check to avoid CORS preflight issues

  audioPlayer.addEventListener('canplay', () => {
    console.log('✅ Stream ready to play');
    console.log(`📊 ReadyState: ${audioPlayer.readyState}, NetworkState: ${audioPlayer.networkState}`);
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
    if (audioPlayer.paused) {
      updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps - Click play`);
    }
    // Asegurar volumen
    if (audioPlayer.volume === 0 && volumeSlider) {
      audioPlayer.volume = volumeSlider.value / 100 || 0.8;
    }
    if (audioPlayer.muted) {
      audioPlayer.muted = false;
    }
  }, { once: false }); // Permitir múltiples eventos canplay

  audioPlayer.addEventListener('canplaythrough', () => {
    console.log('✅ Stream fully loaded');
  });

  // Custom controls
  const customPlayBtn = document.getElementById('customPlayBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeIcon = document.getElementById('volumeIcon');

  // Variable para rastrear si el usuario pausó manualmente
  let userPaused = false;
  
  // Play/Pause button handler
  if (customPlayBtn && audioPlayer) {
    customPlayBtn.addEventListener('click', async () => {
      // Registrar interacción del usuario
      window.lastUserInteraction = Date.now();
      userPaused = false; // Reset cuando el usuario interactúa
      
      console.log('🔘 Play/Pause button clicked');
      console.log(`📊 Audio state - paused: ${audioPlayer.paused}, src: ${audioPlayer.src}`);

      if (audioPlayer.paused) {
        // Try to play
        if (!audioPlayer.src || audioPlayer.src === '' || audioPlayer.src === window.location.href) {
          // No stream selected, load the current station
          console.log('📻 No stream loaded, loading current station...');
          if (currentStation) {
            switchStation(currentStation, true);
            setTimeout(async () => {
              try {
                await audioPlayer.play();
                console.log('✅ Audio playing after station switch');
              } catch (err) {
                console.warn('⚠️ Play prevented:', err);
                updatePlayerDisplay(
                  currentStationDisplay ? currentStationDisplay.textContent : 'Unknown',
                  'Ready',
                  'Click play to start'
                );
              }
            }, 500);
          } else {
            console.warn('❌ No station selected');
          }
        } else {
          // Stream is loaded, try to play
          console.log('▶️ Attempting to play stream...');
          console.log(`📊 ReadyState: ${audioPlayer.readyState}, NetworkState: ${audioPlayer.networkState}, Volume: ${audioPlayer.volume}`);
          
          // Asegurar que el volumen no sea 0
          if (audioPlayer.volume === 0 && volumeSlider) {
            audioPlayer.volume = volumeSlider.value / 100 || 0.8;
          }
          
          // Asegurar que no esté silenciado
          if (audioPlayer.muted) {
            audioPlayer.muted = false;
          }
          
          // Esperar a que el stream esté listo si no lo está (con timeout)
          if (audioPlayer.readyState < 2) {
            console.log('⏳ Esperando a que el stream esté listo...');
            await new Promise((resolve) => {
              let attempts = 0;
              const maxAttempts = 50; // 5 segundos máximo (50 * 100ms)
              const checkReady = () => {
                attempts++;
                if (audioPlayer.readyState >= 2) {
                  resolve();
                } else if (attempts >= maxAttempts) {
                  // Timeout - intentar reproducir de todas formas
                  console.log('⚠️ Timeout esperando readyState, intentando reproducir...');
                  resolve();
                } else if (audioPlayer.readyState === 0 && audioPlayer.networkState === 3) {
                  // No hay datos, esperar un poco más
                  setTimeout(checkReady, 200);
                } else {
                  setTimeout(checkReady, 100);
                }
              };
              checkReady();
            });
          }
          
          try {
            // Asegurarse de que no se esté cargando mientras se intenta reproducir
            if (audioPlayer.networkState === 1) {
              // NETWORK_LOADING - esperar un momento
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            await audioPlayer.play();
            console.log('✅ Audio playing successfully');
            updatePlayerDisplay(
              currentStationDisplay ? currentStationDisplay.textContent : 'Unknown',
              'Playing',
              `Quality: ${currentQuality} kbps`
            );
          } catch (err) {
            // Solo loggear si no es un error común de autoplay
            if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
              console.warn('⚠️ Play prevented:', err.name, err.message);
            }
            
            // Si es AbortError, intentar de nuevo después de un momento
            if (err.name === 'AbortError') {
              console.log('🔄 AbortError detectado, reintentando en 500ms...');
              setTimeout(async () => {
                try {
                  await audioPlayer.play();
                  console.log('✅ Audio playing on retry');
                } catch (retryErr) {
                  if (retryErr.name !== 'NotAllowedError') {
                    console.warn('⚠️ Play failed on retry:', retryErr.name);
                  }
                }
              }, 500);
            } else {
              updatePlayerDisplay(
                currentStationDisplay ? currentStationDisplay.textContent : 'Unknown',
                'Ready',
                'Click play to start'
              );
            }
          }
        }
      } else {
        // Audio is playing, pause it
        console.log('⏸️ Pausing audio...');
        userPaused = true; // Marcar como pausa del usuario
        window.lastUserInteraction = Date.now(); // Actualizar tiempo de interacción
        audioPlayer.pause();
        console.log('✅ Audio paused');
      }
    });

    // Update button state when audio plays/pauses
    audioPlayer.addEventListener('play', () => {
      // console.log('🎵 Play event fired');
      customPlayBtn.classList.add('playing');
    });

  // Contador para evitar bucles infinitos de reanudación
  let autoResumeAttempts = 0;
  let lastAutoResumeTime = 0;
  const MAX_AUTO_RESUME_ATTEMPTS = 3;
  const AUTO_RESUME_COOLDOWN = 5000; // 5 segundos entre intentos

  audioPlayer.addEventListener('pause', () => {
    console.log('⏸️ Pause event fired');
    console.log(`📊 Pause - ReadyState: ${audioPlayer.readyState}, NetworkState: ${audioPlayer.networkState}, Ended: ${audioPlayer.ended}`);
    customPlayBtn.classList.remove('playing');
    
    // Verificar si fue pausa del usuario o automática del navegador
    const timeSinceLastInteraction = Date.now() - (window.lastUserInteraction || 0);
    const wasUserPause = timeSinceLastInteraction < 1000; // Si hubo interacción en el último segundo, fue el usuario
    
    // Si el stream terminó prematuramente (no fue pausa del usuario), reconectar
    if (audioPlayer.ended) {
      const timeSinceLastInteraction = Date.now() - (window.lastUserInteraction || 0);
      const wasUserPause = timeSinceLastInteraction < 1000;
      
      // Si no fue pausa del usuario y el stream terminó, probablemente fue cancelado por Cloudflare
      if (!wasUserPause && audioPlayer.src && !isReconnecting) {
        const playDuration = Date.now() - (window.streamStartTime || Date.now());
        console.log(`⚠️ Stream terminó prematuramente después de ${(playDuration/1000).toFixed(1)}s, probablemente cancelado por Cloudflare. Reconectando...`);
        userPaused = false;
        autoResumeAttempts = 0;
        
        // Reconectar INMEDIATAMENTE (sin delay para respuesta instantánea)
        if (audioPlayer.ended && !isReconnecting && audioPlayer.src) {
          attemptReconnection();
        }
        return;
      }
      
      // Si fue pausa del usuario, no hacer nada
      userPaused = wasUserPause;
      autoResumeAttempts = 0;
      return;
    }
    
    if (!wasUserPause && !audioPlayer.ended && audioPlayer.readyState >= 2 && audioPlayer.networkState === 2) {
      // Verificar buffer antes de intentar reanudar
      let bufferAhead = 0;
      if (audioPlayer.buffered.length > 0) {
        const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
        bufferAhead = bufferedEnd - audioPlayer.currentTime;
      }
      
      // Solo intentar reanudar si:
      // 1. Hay buffer suficiente (> 2 segundos)
      // 2. No hemos excedido el número máximo de intentos
      // 3. Ha pasado suficiente tiempo desde el último intento
      const timeSinceLastResume = Date.now() - lastAutoResumeTime;
      const shouldAttemptResume = bufferAhead > 2 && 
                                   autoResumeAttempts < MAX_AUTO_RESUME_ATTEMPTS &&
                                   timeSinceLastResume > AUTO_RESUME_COOLDOWN;
      
      if (shouldAttemptResume) {
        console.log(`🔄 Audio pausado automáticamente, buffer: ${bufferAhead.toFixed(2)}s, intentando reanudar (intento ${autoResumeAttempts + 1}/${MAX_AUTO_RESUME_ATTEMPTS})...`);
        userPaused = false;
        autoResumeAttempts++;
        lastAutoResumeTime = Date.now();
        
        // Esperar un momento para que el buffer se recupere más
        setTimeout(() => {
          // Verificar buffer nuevamente antes de reanudar
          let currentBuffer = 0;
          if (audioPlayer.buffered.length > 0) {
            const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
            currentBuffer = bufferedEnd - audioPlayer.currentTime;
          }
          
          if (audioPlayer.paused && !audioPlayer.ended && audioPlayer.readyState >= 2 && 
              !userPaused && currentBuffer > 1) {
            audioPlayer.play().then(() => {
              console.log('✅ Reanudación automática exitosa');
              autoResumeAttempts = 0; // Reset contador en éxito
            }).catch(err => {
              if (err.name !== 'NotAllowedError') {
                console.log(`⚠️ No se pudo reanudar automáticamente: ${err.name}`);
              }
            });
          } else {
            console.log(`⚠️ Buffer insuficiente para reanudar: ${currentBuffer.toFixed(2)}s`);
          }
        }, 2000); // Esperar 2 segundos para que el buffer se recupere
      } else {
        if (bufferAhead <= 2) {
          console.log(`⚠️ Buffer muy bajo (${bufferAhead.toFixed(2)}s), no se intentará reanudar automáticamente`);
        }
        if (autoResumeAttempts >= MAX_AUTO_RESUME_ATTEMPTS) {
          console.log('⚠️ Máximo de intentos de reanudación alcanzado, esperando interacción del usuario');
        }
      }
    } else {
      userPaused = wasUserPause;
      // Reset contador cuando el usuario pausa manualmente
      if (wasUserPause) {
        autoResumeAttempts = 0;
      }
    }
  });

    // Also listen for 'playing' event to ensure state is correct
    audioPlayer.addEventListener('playing', () => {
      console.log('🎵 Playing event fired - audio is actually playing');
      customPlayBtn.classList.add('playing');
      // Reset contador cuando realmente está reproduciéndose
      autoResumeAttempts = 0;
    });

    // Detectar cuando el stream termina prematuramente (probablemente cancelado por Cloudflare)
    audioPlayer.addEventListener('ended', () => {
      const timeSinceLastInteraction = Date.now() - (window.lastUserInteraction || 0);
      const wasUserPause = timeSinceLastInteraction < 1000;
      
      // Si no fue pausa del usuario y el stream terminó, probablemente fue cancelado por Cloudflare
      if (!wasUserPause && audioPlayer.src && !isReconnecting && !userPaused) {
        const playDuration = Date.now() - (window.streamStartTime || Date.now());
        console.log(`⚠️ Stream terminó prematuramente después de ${(playDuration/1000).toFixed(1)}s (probablemente cancelado por Cloudflare). Reconectando...`);
        userPaused = false;
        autoResumeAttempts = 0;
        
        // Reconectar INMEDIATAMENTE (sin delay para respuesta instantánea)
        if (audioPlayer.ended && !isReconnecting && audioPlayer.src && !userPaused) {
          log('🔄 Intentando reconectar stream inmediatamente...');
          attemptReconnection();
        }
      }
    });
  }

  // Volume control handler
  if (volumeSlider && audioPlayer) {
    // Set initial volume
    audioPlayer.volume = volumeSlider.value / 100;

    // Load saved volume
    const savedVolume = localStorage.getItem('audioVolume');
    if (savedVolume !== null) {
      const volume = parseInt(savedVolume);
      audioPlayer.volume = volume / 100;
      volumeSlider.value = volume;
      updateVolumeIcon(volume);
    }

    volumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value;
      audioPlayer.volume = volume / 100;
      localStorage.setItem('audioVolume', volume);
      updateVolumeIcon(volume);
    });

    // Volume icon click to mute/unmute
    if (volumeIcon) {
      volumeIcon.addEventListener('click', () => {
        if (audioPlayer.volume > 0) {
          audioPlayer.dataset.previousVolume = audioPlayer.volume;
          audioPlayer.volume = 0;
          volumeSlider.value = 0;
          updateVolumeIcon(0);
        } else {
          const prevVolume = parseFloat(audioPlayer.dataset.previousVolume || 1);
          audioPlayer.volume = prevVolume;
          volumeSlider.value = prevVolume * 100;
          updateVolumeIcon(prevVolume * 100);
        }
      });
    }
  }

  function updateVolumeIcon(volume) {
    if (!volumeIcon) return;
    if (volume === 0 || volume === '0') {
      volumeIcon.textContent = '🔇';
    } else if (volume < 50) {
      volumeIcon.textContent = '🔉';
    } else {
      volumeIcon.textContent = '🔊';
    }
  }

  // Smooth animation when bento-style cards appear
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.bento-card').forEach(card => observer.observe(card));
});
