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

  // Fade-in effect on page load
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });

  // Station management
  const stationButtons = document.querySelectorAll('.station-btn');
  const audioPlayer = document.getElementById('audioPlayer');
  const currentStationDisplay = document.getElementById('currentStation');
  const playerStatusDisplay = document.getElementById('playerStatus');
  let currentStation = null;

  // Update player display
  function updatePlayerDisplay(stationName, status) {
    if (currentStationDisplay) {
      currentStationDisplay.textContent = stationName;
    }
    if (playerStatusDisplay) {
      playerStatusDisplay.textContent = status;
    }
  }

  stationButtons.forEach(button => {
    button.addEventListener('click', () => {
      const stationUrl = button.getAttribute('data-url');
      const stationId = button.getAttribute('data-station');
      const stationName = button.querySelector('.station-name').textContent;

      // Update active state
      stationButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Change audio source if different station
      if (currentStation !== stationId) {
        const wasPlaying = !audioPlayer.paused;
        
        audioPlayer.src = stationUrl;
        audioPlayer.load();
        
        // Update display
        updatePlayerDisplay(stationName, wasPlaying ? 'Playing' : 'Paused');
        
        if (wasPlaying) {
          audioPlayer.play().catch(err => {
            console.warn('Auto-play prevented:', err);
            updatePlayerDisplay(stationName, 'Paused');
          });
        }
        
        currentStation = stationId;
        console.log(`🎵 Switched to ${stationName}`);
      }
    });
  });

  // Set initial station
  const initialStation = document.querySelector('.station-btn.active');
  if (initialStation) {
    currentStation = initialStation.getAttribute('data-station');
    const stationName = initialStation.querySelector('.station-name').textContent;
    audioPlayer.src = initialStation.getAttribute('data-url');
    updatePlayerDisplay(stationName, 'Paused');
  }

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

    // Allows restarting the stream if it stops accidentally
    audioPlayer.addEventListener('error', () => {
      console.warn('⚠️ Stream error. Attempting to reconnect...');
      updatePlayerDisplay(
        currentStationDisplay ? currentStationDisplay.textContent : 'Station 01',
        'Error'
      );
      setTimeout(() => {
        audioPlayer.load();
        audioPlayer.play().catch(() => {
          console.log('Retry failed');
          updatePlayerDisplay(
            currentStationDisplay ? currentStationDisplay.textContent : 'Station 01',
            'Error'
          );
        });
      }, 3000);
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
