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

  // Test if stream URL is accessible
  async function testStreamUrl(url) {
    return new Promise((resolve) => {
      const testAudio = new Audio();
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          testAudio.src = '';
          console.warn(`⏱️ Timeout testing stream: ${url}`);
          resolve(false);
        }
      }, 5000); // 5 second timeout
      
      testAudio.addEventListener('canplay', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testAudio.src = '';
          console.log(`✅ Stream is accessible: ${url}`);
          resolve(true);
        }
      });
      
      testAudio.addEventListener('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testAudio.src = '';
          console.warn(`❌ Stream not accessible: ${url}`);
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

  // Update track info (placeholder - will need Icecast API integration)
  function updateTrackInfo(stationName) {
    // TODO: Fetch track info from Icecast API
    // For now, show placeholder
    if (trackNameDisplay) {
      trackNameDisplay.textContent = 'Now playing on ' + stationName;
    }
    
    // TODO: Fetch artwork from API or metadata
    // For now, show placeholder
    if (artworkPlaceholder) {
      artworkPlaceholder.style.display = 'flex';
    }
    if (trackArtwork) {
      trackArtwork.style.display = 'none';
    }
  }

  // Fetch track info from Icecast (if available)
  async function fetchTrackInfo(baseUrl) {
    try {
      // Try to fetch from Icecast status JSON
      // This is a common endpoint for Icecast servers
      const statusUrl = baseUrl.replace('/192.mp3', '').replace('/320.mp3', '') + '/status-json.xsl';
      
      const response = await fetch(statusUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.icestats && data.icestats.source) {
          const source = Array.isArray(data.icestats.source) 
            ? data.icestats.source[0] 
            : data.icestats.source;
          
          if (source.yp_currently_playing) {
            return {
              title: source.yp_currently_playing,
              artwork: null // Icecast doesn't typically provide artwork
            };
          }
        }
      }
    } catch (error) {
      console.log('Track info not available:', error);
    }
    return null;
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
    
    console.log(`🔄 Switching to ${stationName}`);
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`🎵 Stream URL: ${streamUrl}`);
    console.log(`📊 Quality: ${currentQuality} kbps`);
    
    const wasPlaying = !audioPlayer.paused && keepPlaying;
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
    
    // Set new source
    currentStation = stationId;
    currentBaseUrl = baseUrl;
    
    // Test stream accessibility first
    console.log(`🧪 Testing stream accessibility: ${streamUrl}`);
    updatePlayerDisplay(stationName, 'Checking...', 'Verifying stream availability...');
    
    testStreamUrl(streamUrl).then(isAccessible => {
      if (!isAccessible) {
        console.error(`❌ Stream not accessible: ${streamUrl}`);
        updatePlayerDisplay(stationName, 'Unavailable', 'Stream not accessible. Check server or try different quality.');
        console.warn('💡 Tips:');
        console.warn('   1. Verify the stream is running on the server');
        console.warn('   2. Check if CORS is enabled on the server');
        console.warn('   3. Try opening the URL directly in browser:', streamUrl);
        console.warn('   4. Check if port 8000 is accessible');
        return;
      }
      
      // Load new stream
      console.log(`🔗 Setting audio source to: ${streamUrl}`);
      audioPlayer.src = streamUrl;
      
      // Wait a bit before loading to ensure source is set
      setTimeout(() => {
        console.log(`📥 Loading audio element...`);
        audioPlayer.load();
        
        // Try to play if was playing before
        if (wasPlaying) {
          setTimeout(() => {
            console.log(`▶️ Attempting to play...`);
            audioPlayer.play().catch(err => {
              console.warn('⚠️ Auto-play prevented:', err.name, err.message);
              updatePlayerDisplay(stationName, 'Ready', 'Click play to start');
            });
          }, 100);
        } else {
          updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps - Click play`);
          console.log(`⏸️ Stream loaded, waiting for user to click play`);
        }
      }, 50);
    });
    
    // Try to fetch track info
    fetchTrackInfo(baseUrl).then(info => {
      if (info && info.title) {
        if (trackNameDisplay) {
          trackNameDisplay.textContent = info.title;
        }
      } else {
        if (trackNameDisplay) {
          trackNameDisplay.textContent = `Now playing on ${stationName}`;
        }
      }
    }).catch(err => {
      console.log('Track info not available:', err);
      if (trackNameDisplay) {
        trackNameDisplay.textContent = `Now playing on ${stationName}`;
      }
    });
    
    // Start periodic track info updates
    if (trackInfoInterval) {
      clearInterval(trackInfoInterval);
    }
    trackInfoInterval = setInterval(() => {
      if (currentBaseUrl) {
        fetchTrackInfo(currentBaseUrl).then(info => {
          if (info && info.title && trackNameDisplay) {
            trackNameDisplay.textContent = info.title;
          }
        }).catch(() => {
          // Silently fail - track info is optional
        });
      }
    }, 10000); // Update every 10 seconds
    
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
      
      switchStation(stationId, false);
    });
  });

  // Set initial station (but don't load stream automatically)
  const initialStation = document.querySelector('.station-btn.active');
  if (initialStation) {
    const stationId = initialStation.getAttribute('data-station');
    const stationName = initialStation.querySelector('.station-name').textContent;
    currentStation = stationId;
    currentBaseUrl = initialStation.getAttribute('data-base-url');
    
    console.log(`🎯 Initial station: ${stationName} (ID: ${stationId})`);
    updatePlayerDisplay(stationName, 'Ready', 'Select a station and click play');
    
    // Don't load stream automatically - wait for user to click play
    // This avoids timeout errors on page load
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
    });

    audioPlayer.addEventListener('pause', () => {
      console.log('⏸️ Playback paused');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Paused', '');
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
        switch(error.code) {
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
                  audioPlayer.load();
                  audioPlayer.play().catch(() => {
                    updatePlayerDisplay(stationName, 'Ready', 'Click play to retry');
                  });
                }, 3000);
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
            console.warn('   4. Port 8000 is blocked or not accessible');
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

    audioPlayer.addEventListener('stalled', () => {
      console.warn('⚠️ Stream stalled');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Buffering...', 'Loading stream...');
    });

    audioPlayer.addEventListener('waiting', () => {
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Buffering...', 'Loading stream...');
    });

    audioPlayer.addEventListener('loadstart', () => {
      console.log('📡 Loading stream...');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Loading...', 'Connecting to stream...');
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
      console.log('✅ Stream metadata loaded');
      const stationName = currentStationDisplay ? currentStationDisplay.textContent : 'Deep House';
      updatePlayerDisplay(stationName, 'Ready', `Quality: ${currentQuality} kbps`);
    });

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
