// Vinyl Beats Radio - Interactive features
// ----------------------------------

document.addEventListener('DOMContentLoaded', () => {
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

  // Keyboard navigation support
  themeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      themeToggle.click();
    }
  });

  function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // Fade-in effect on page load
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });

  // Station management
  const stationButtons = document.querySelectorAll('.station-btn');
  const audioPlayer = document.getElementById('audioPlayer');
  const currentStationDisplay = document.getElementById('currentStation');
  const playerStatusDisplay = document.getElementById('playerStatus');
  const streamStatusDisplay = document.getElementById('streamStatus');
  let currentStation = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectTimeout = null;

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

  // Check stream availability
  async function checkStreamAvailability(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      return true;
    } catch (error) {
      // Try with a timeout
      return new Promise((resolve) => {
        const audio = new Audio();
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            audio.src = '';
            resolve(false);
          }
        }, 3000);

        audio.addEventListener('canplay', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            audio.src = '';
            resolve(true);
          }
        });

        audio.addEventListener('error', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });

        audio.src = url;
      });
    }
  }

  // Handle stream errors with better UX
  function handleStreamError(stationName, url) {
    reconnectAttempts++;
    
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      updatePlayerDisplay(stationName, 'Reconnecting...', `Intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
      
      reconnectTimeout = setTimeout(async () => {
        const isAvailable = await checkStreamAvailability(url);
        
        if (isAvailable) {
          reconnectAttempts = 0;
          audioPlayer.load();
          audioPlayer.play().catch(() => {
            updatePlayerDisplay(stationName, 'Paused', 'Stream disponible - Haz clic en play');
          });
        } else {
          handleStreamError(stationName, url);
        }
      }, 3000 * reconnectAttempts); // Exponential backoff
    } else {
      reconnectAttempts = 0;
      updatePlayerDisplay(stationName, 'Offline', 'Stream no disponible. La emisora estará disponible pronto.');
    }
  }

  stationButtons.forEach(button => {
    // Keyboard navigation support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    button.addEventListener('click', async () => {
      const stationUrl = button.getAttribute('data-url');
      const stationId = button.getAttribute('data-station');
      const stationName = button.querySelector('.station-name').textContent;

      // Update active state
      stationButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Change audio source if different station
      if (currentStation !== stationId) {
        const wasPlaying = !audioPlayer.paused;
        reconnectAttempts = 0;
        
        // Clear any pending reconnection
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        
        // Check stream availability before switching
        updatePlayerDisplay(stationName, 'Loading...', 'Verificando disponibilidad...');
        
        const isAvailable = await checkStreamAvailability(stationUrl);
        
        if (isAvailable) {
          audioPlayer.src = stationUrl;
          audioPlayer.load();
          updatePlayerDisplay(stationName, wasPlaying ? 'Playing' : 'Paused', '');
          
          if (wasPlaying) {
            audioPlayer.play().catch(err => {
              console.warn('Auto-play prevented:', err);
              updatePlayerDisplay(stationName, 'Paused', 'Haz clic en play para escuchar');
            });
          }
        } else {
          updatePlayerDisplay(stationName, 'Offline', 'Stream no disponible. La emisora estará disponible pronto.');
          audioPlayer.src = '';
        }
        
        currentStation = stationId;
        console.log(`🎵 Switched to ${stationName} - Available: ${isAvailable}`);
      }
    });
  });

  // Set initial station
  const initialStation = document.querySelector('.station-btn.active');
  if (initialStation) {
    currentStation = initialStation.getAttribute('data-station');
    const stationName = initialStation.querySelector('.station-name').textContent;
    const stationUrl = initialStation.getAttribute('data-url');
    
    // Don't load stream automatically - wait for user interaction
    updatePlayerDisplay(stationName, 'Ready', 'Haz clic en play cuando la emisora esté disponible');
    
    // Optional: Check availability on load (commented to avoid unnecessary requests)
    // checkStreamAvailability(stationUrl).then(isAvailable => {
    //   if (isAvailable) {
    //     audioPlayer.src = stationUrl;
    //     updatePlayerDisplay(stationName, 'Ready', '');
    //   } else {
    //     updatePlayerDisplay(stationName, 'Offline', 'La emisora estará disponible pronto');
    //   }
    // });
  }

  // Network status monitoring
  window.addEventListener('online', () => {
    console.log('✅ Conexión restaurada');
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Station 01';
    updatePlayerDisplay(stationName, playerStatusDisplay.textContent, 'Conexión restaurada');
  });

  window.addEventListener('offline', () => {
    console.warn('⚠️ Sin conexión');
    const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Station 01';
    updatePlayerDisplay(stationName, 'Offline', 'Sin conexión a internet');
  });

  // Player control
  if (audioPlayer) {
    audioPlayer.addEventListener('play', () => {
      console.log('🎵 Playback started');
      updatePlayerDisplay(
        currentStationDisplay ? currentStationDisplay.textContent : 'Station 01',
        'Playing'
      );
    });

    audioPlayer.addEventListener('pause', () => {
      console.log('⏸️ Playback paused');
      updatePlayerDisplay(
        currentStationDisplay ? currentStationDisplay.textContent : 'Station 01',
        'Paused'
      );
    });

    audioPlayer.addEventListener('playing', () => {
      updatePlayerDisplay(
        currentStationDisplay ? currentStationDisplay.textContent : 'Station 01',
        'Playing'
      );
    });

    // Handle stream errors with better UX
    audioPlayer.addEventListener('error', (e) => {
      const error = audioPlayer.error;
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Station 01';
      const currentUrl = audioPlayer.src;
      
      console.warn('⚠️ Stream error:', error ? error.code : 'Unknown error');
      
      if (error) {
        switch(error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            updatePlayerDisplay(stationName, 'Aborted', 'Conexión cancelada');
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            updatePlayerDisplay(stationName, 'Network Error', 'Error de red. Verificando...');
            if (currentUrl) handleStreamError(stationName, currentUrl);
            break;
          case MediaError.MEDIA_ERR_DECODE:
            updatePlayerDisplay(stationName, 'Decode Error', 'Error al decodificar el stream');
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            updatePlayerDisplay(stationName, 'Not Supported', 'Formato no soportado o stream no disponible');
            break;
          default:
            updatePlayerDisplay(stationName, 'Error', 'Error desconocido. La emisora estará disponible pronto.');
            if (currentUrl) handleStreamError(stationName, currentUrl);
        }
      } else {
        updatePlayerDisplay(stationName, 'Error', 'Error al conectar. La emisora estará disponible pronto.');
        if (currentUrl) handleStreamError(stationName, currentUrl);
      }
    });

    // Handle stalled stream
    audioPlayer.addEventListener('stalled', () => {
      console.warn('⚠️ Stream stalled');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Station 01';
      updatePlayerDisplay(stationName, 'Buffering...', 'Cargando stream...');
    });

    // Handle waiting/buffering
    audioPlayer.addEventListener('waiting', () => {
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Station 01';
      updatePlayerDisplay(stationName, 'Buffering...', 'Cargando stream...');
    });

    // Handle canplay - stream is ready
    audioPlayer.addEventListener('canplay', () => {
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Station 01';
      if (audioPlayer.paused) {
        updatePlayerDisplay(stationName, 'Ready', '');
      }
    });
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
