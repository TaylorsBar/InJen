const CACHE_NAME = 'genesis-telemetry-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  // Add other critical JS/TSX files
  '/components/Dashboard.tsx',
  '/components/VideoOverlay.tsx',
  '/components/RunHistory.tsx',
  '/components/CoachingModal.tsx',
  '/components/Gauge.tsx',
  '/components/RaceMap.tsx',
  '/components/RealTimeChart.tsx',
  '/components/TranscriptOverlay.tsx',
  '/components/VoiceControl.tsx',
  '/components/ChatView.tsx',
  '/components/FullscreenHud.tsx',
  '/components/CameraFeed.tsx',
  '/components/LapTimer.tsx',
  '/components/ToggleSwitch.tsx',
  '/components/RecordingControl.tsx',
  '/components/RecordingModal.tsx',
  '/components/icons.tsx',
  '/components/ToolsModal.tsx',
  '/components/CanSniffer.tsx',
  '/components/RaceDash.tsx',
  '/components/EvoRaceDash.tsx',
  '/components/AutometerTach.tsx',
  '/components/TireMonitor.tsx',
  '/components/DeltaTimer.tsx',
  '/components/GForceMeter.tsx',
  '/components/SensorPermissionModal.tsx',
  '/hooks/useTelemetry.ts',
  '/hooks/useVoiceCommands.ts',
  '/hooks/useRecording.ts',
  '/hooks/useTheme.tsx',
  '/hooks/useAnimatedValue.ts',
  '/hooks/useDeviceSensors.ts',
  '/hooks/useCanBus.ts',
  '/services/geminiService.ts',
  '/services/ttsService.ts',
  '/services/voiceService.ts',
  '/services/chatService.ts',
  '/services/lapTimingService.ts',
  '/services/realtimeCoachingService.ts',
  '/services/platformService.ts',
  '/services/obdService.ts',
  '/services/canService.ts',
  '/lib/TelemetryCharts.ts',
  '/lib/VehiclePhysics.ts',
  '/lib/SensorFusionSDK.ts',
  '/lib/themes.ts',
  '/types.ts',
  '/constants.ts',
  '/config.ts',
  // External assets
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@400;500;700;900&display=swap',
  'https://cdn.plot.ly/plotly-latest.min.js',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/client',
  'https://aistudiocdn.com/@google/genai@^1.27.0',
  'https://aistudiocdn.com/react-map-gl@^7.1.7',
  'https://aistudiocdn.com/mapbox-gl@^3.5.2',
  'https://aistudiocdn.com/mapbox-gl@^3.5.2/mapbox-gl.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll with a catch to prevent install failure on single resource fail
        return cache.addAll(urlsToCache).catch(err => {
          console.error('Failed to cache all URLs:', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Only cache requests to our own origin or trusted CDNs
            const isCacheable = urlsToCache.some(url => event.request.url.startsWith(url));
            if (isCacheable) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
            }

            return response;
          }
        ).catch(() => {
            // If fetch fails (e.g., offline), try to return a fallback from cache if available
            // For example, return the base index.html for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});