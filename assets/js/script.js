// Vinyl Vibes Radio - Interactive features
// ----------------------------------

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
  let currentQuality = parseInt(localStorage.getItem('audioQuality')) || 320; // Default to 320 kbps

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
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectTimeout = null;
  let trackInfoInterval = null;

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

    // console.log(`🔄 Switching to ${stationName}`);
    // console.log(`📍 Base URL: ${baseUrl}`);
    // console.log(`🎵 Stream URL: ${streamUrl}`);
    // console.log(`📊 Quality: ${currentQuality} kbps`);

    // If keepPlaying is true, we want to auto-play regardless of current state
    const shouldAutoPlay = keepPlaying;
    const wasPlaying = !audioPlayer.paused;
    reconnectAttempts = 0;

    // Clear any pending reconnection
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Stop current playback
    audioPlayer.pause();
    audioPlayer.src = '';

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

    // Set the source immediately to prevent errors
    console.log(`🔗 Setting audio source to: ${streamUrl}`);
    audioPlayer.src = streamUrl;

    // Verify the source was set correctly
    if (audioPlayer.src !== streamUrl && audioPlayer.src !== streamUrl + '/') {
      console.warn(`⚠️ Source mismatch. Expected: ${streamUrl}, Got: ${audioPlayer.src}`);
      // Force set it again
      audioPlayer.src = '';
      setTimeout(() => {
        audioPlayer.src = streamUrl;
      }, 10);
    }

    // Load the stream immediately (don't wait for test)
    updatePlayerDisplay(stationName, 'Loading...', `Quality: ${currentQuality} kbps`);

    setTimeout(() => {
      // console.log('📥 Loading audio element...');
      // console.log('✅ Verified audio source:', audioPlayer.src);
      audioPlayer.load();

      // Try to play if shouldAutoPlay is true
      if (shouldAutoPlay) {
        // Wait for stream to be ready before attempting play
        let playAttempted = false;
        const attemptPlay = () => {
          if (playAttempted) return;

          if (audioPlayer.readyState >= 1 || audioPlayer.readyState === 0) {
            playAttempted = true;
            console.log(`▶️ Attempting to auto-play...`);
            audioPlayer.play().then(() => {
              console.log('✅ Auto-play successful');
            }).catch(err => {
              // Only log if it's not a user interaction error (normal browser behavior)
              if (err.name !== 'NotAllowedError') {
                console.warn('⚠️ Auto-play prevented:', err.name, err.message);
              } else {
                console.log('⚠️ Auto-play requires user interaction (normal browser behavior)');
              }
              updatePlayerDisplay(stationName, 'Ready', 'Click play to start');
              playAttempted = false; // Allow retry
            });
          } else {
            // Stream not ready yet, wait a bit more
            setTimeout(attemptPlay, 100);
          }
        };

        // Try multiple times with different delays
        setTimeout(attemptPlay, 200);
        setTimeout(attemptPlay, 500);
        setTimeout(attemptPlay, 1000);

        // Also listen to ready events
        ['canplay', 'loadeddata'].forEach(eventName => {
          audioPlayer.addEventListener(eventName, attemptPlay, { once: true });
        });
      } else {
        updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps - Click play`);
        console.log(`⏸️ Stream loaded, waiting for user to click play`);
      }
    }, 50);

    // Stream test disabled to prevent 404 errors - streams work without testing

    // Track info will be updated via metadata events
    updateTrackInfo(stationName);

    // Metadata polling DISABLED - /admin/stats.xml endpoint blocked by Cloudflare (502)
    // Track info will rely on ICY metadata from stream (if available)
    if (trackInfoInterval) {
      clearInterval(trackInfoInterval);
      trackInfoInterval = null;
    }

    console.log(`✅ Switched to ${stationName} - ${currentQuality} kbps`);
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
      console.log('🎵 Playback started');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Playing', `Quality: ${currentQuality} kbps`);

      // Enable background playback
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          audioPlayer.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioPlayer.pause();
        });
      }
    });

    audioPlayer.addEventListener('pause', () => {
      console.log('⏸️ Playback paused');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Paused', '');

      // Update play button icon
      if (customPlayBtn) {
        customPlayBtn.classList.remove('playing');
      }
    });

    audioPlayer.addEventListener('playing', () => {
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Playing', `Quality: ${currentQuality} kbps`);
    });

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
            errorMessage = 'Network error - Check CORS or connection';
            updatePlayerDisplay(stationName, 'Network Error', errorMessage);
            console.warn('⚠️ Media error: Network');
            console.warn('💡 Tip: Check if server allows CORS or if stream is accessible');
            if (currentUrl) {
              reconnectAttempts++;
              if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                console.log(`🔄 Retry attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                reconnectTimeout = setTimeout(() => {
                  if (audioPlayer.paused) return; // Don't reconnect if user paused
                  audioPlayer.load();
                  audioPlayer.play().catch(() => {
                    updatePlayerDisplay(stationName, 'Ready', 'Click play to retry');
                  });
                }, 5000); // Increased to 5s to allow server to recover
              } else {
                console.error('❌ Max reconnection attempts reached');
                updatePlayerDisplay(stationName, 'Error', 'Stream unavailable - Check server');
              }
            }
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Error decoding stream - Invalid format';
            updatePlayerDisplay(stationName, 'Decode Error', errorMessage);
            console.warn('⚠️ Media error: Decode');
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Stream unavailable or format not supported';
            updatePlayerDisplay(stationName, 'Unavailable', errorMessage);
            console.warn('⚠️ Media error: Source not supported (Code 4)');
            console.warn('💡 Possible causes:');
            console.warn('   1. Stream is not running on the server');
            console.warn('   2. CORS is not enabled (server must allow cross-origin requests)');
            console.warn('   3. URL is incorrect or server is not accessible');
            console.warn('   4. Stream URL is incorrect or not accessible');
            console.warn(`📋 Test URL directly: ${currentUrl}`);
            console.warn('🔧 Server should have CORS headers:');
            console.warn('   Access-Control-Allow-Origin: *');
            console.warn('   Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

    let stalledTimeout = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    audioPlayer.addEventListener('stalled', () => {
      // Don't aggressively try to recover for stalled streams
      // Modern browsers handle this well on their own
      if (audioPlayer.paused) return;

      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Buffering...', 'Stream loading...');
    });

    // Reset reconnect attempts on successful playback
    audioPlayer.addEventListener('playing', () => {
      if (stalledTimeout) {
        clearTimeout(stalledTimeout);
        stalledTimeout = null;
      }
      reconnectAttempts = 0; // Reset on successful play
    });

    // Improve reconnection handling for stream interruptions
    let reconnectTimeout = null;
    let isReconnecting = false;

    audioPlayer.addEventListener('error', (e) => {
      const error = audioPlayer.error;
      if (error && error.code === MediaError.MEDIA_ERR_NETWORK && !isReconnecting) {
        console.warn('⚠️ Network error detected, attempting reconnection...');
        isReconnecting = true;

        // Clear any existing timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }

        // Try to reload and reconnect after a delay
        reconnectTimeout = setTimeout(() => {
          if (audioPlayer.paused) return; // Don't reconnect if user paused

          if (currentStation && audioPlayer.src) {
            console.log('🔄 Attempting to reconnect to stream...');
            const currentSrc = audioPlayer.src;
            audioPlayer.src = '';
            setTimeout(() => {
              audioPlayer.src = currentSrc;
              audioPlayer.load();
              audioPlayer.play().catch(() => {
                console.log('⏳ Waiting for stream to be ready...');
                isReconnecting = false;
              });
            }, 500);
          } else {
            isReconnecting = false;
          }
        }, 2000);
      }
    });

    // Reset reconnection flag when stream starts playing successfully
    audioPlayer.addEventListener('playing', () => {
      if (isReconnecting) {
        console.log('✅ Stream reconnected successfully');
        isReconnecting = false;
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      }
    });

    audioPlayer.addEventListener('waiting', () => {
      // Only show buffering message if not paused by user
      if (audioPlayer.paused) return;

      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Buffering...', 'Loading stream...');

      // Slight delay then try to resume - but DON'T clear the src
      setTimeout(() => {
        if (audioPlayer.paused) return;
        // Just try to play, don't manipulate the src at all
        if (audioPlayer.readyState >= 2) {
          audioPlayer.play().catch(() => {
            // Play might be blocked, that's OK
          });
        }
      }, 1500);
    });

    // Improve buffer handling - monitor buffer health
    audioPlayer.addEventListener('progress', () => {
      // Stream is downloading data - check buffer health
      if (audioPlayer.buffered.length > 0) {
        const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
        const currentTime = audioPlayer.currentTime;
        const bufferAhead = bufferedEnd - currentTime;

        // If buffer is healthy (> 5 seconds), ensure playback continues
        if (bufferAhead > 5 && audioPlayer.paused && !audioPlayer.ended) {
          audioPlayer.play().catch(() => {
            // Play might be blocked, that's OK
          });
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
      extractMetadataFromAudio();
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
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      if (audioPlayer.paused) {
        updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps - Click play`);
      }
    });

    audioPlayer.addEventListener('canplaythrough', () => {
      console.log('✅ Stream fully loaded');
    });
  }

  // Custom controls
  const customPlayBtn = document.getElementById('customPlayBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeIcon = document.getElementById('volumeIcon');

  // Play/Pause button handler
  if (customPlayBtn && audioPlayer) {
    customPlayBtn.addEventListener('click', async () => {
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
          try {
            await audioPlayer.play();
            console.log('✅ Audio playing successfully');
          } catch (err) {
            console.warn('⚠️ Play prevented:', err.name, err.message);
            updatePlayerDisplay(
              currentStationDisplay ? currentStationDisplay.textContent : 'Unknown',
              'Ready',
              'Click play to start'
            );
          }
        }
      } else {
        // Audio is playing, pause it
        console.log('⏸️ Pausing audio...');
        audioPlayer.pause();
        console.log('✅ Audio paused');
      }
    });

    // Update button state when audio plays/pauses
    audioPlayer.addEventListener('play', () => {
      console.log('🎵 Play event fired');
      customPlayBtn.classList.add('playing');
    });

    audioPlayer.addEventListener('pause', () => {
      console.log('⏸️ Pause event fired');
      customPlayBtn.classList.remove('playing');
    });

    // Also listen for 'playing' event to ensure state is correct
    audioPlayer.addEventListener('playing', () => {
      console.log('🎵 Playing event fired - audio is actually playing');
      customPlayBtn.classList.add('playing');
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
