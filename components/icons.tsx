
import React from 'react';

export const KarapiroLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 300 90" 
    className={className}
    aria-label="Karapiro Cartel Speed Shop"
  >
    <defs>
      <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#b0b0b0" />
        <stop offset="50%" stopColor="#404040" />
        <stop offset="55%" stopColor="#b0b0b0" />
        <stop offset="100%" stopColor="#ffffff" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="black" floodOpacity="0.7"/>
      </filter>
    </defs>

    {/* Top text */}
    <text x="150" y="25" textAnchor="middle" fill="#666" fontFamily="'Orbitron', sans-serif" fontSize="12" letterSpacing="8" fontWeight="bold">
      KARAPIRO
    </text>

    {/* Main text */}
    <text x="150" y="60" textAnchor="middle" fill="url(#chrome)" stroke="#000" strokeWidth="0.5" fontFamily="'Orbitron', sans-serif" fontSize="42" fontWeight="900" letterSpacing="-1" filter="url(#shadow)">
      CARTEL
    </text>
    
    {/* Subtext */}
    <text x="150" y="80" textAnchor="middle" fill="#888" fontFamily="monospace" fontSize="9" letterSpacing="2" fontWeight="bold">
      STATE HIGHWAY SPEED SHOP
    </text>
    
    {/* Racing Stripes */}
    <rect x="20" y="40" width="20" height="4" fill="#D32F2F" transform="skewX(-20)" />
    <rect x="45" y="40" width="10" height="4" fill="#D32F2F" transform="skewX(-20)" />
    
    <rect x="245" y="40" width="10" height="4" fill="#D32F2F" transform="skewX(-20)" />
    <rect x="260" y="40" width="20" height="4" fill="#D32F2F" transform="skewX(-20)" />

  </svg>
);

export const KARAPIRO_CARTEL_LOGO_B64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgODAwIDIwMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJtZXRhbEdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmZmIiBzdG9wLW9wYWNpdHk9IjAuOCIvPjxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjYWFhIiBzdG9wLW9wYWNpdHk9IjEiLz48c3RvcCBvZmZzZXQ9IjUxJSIgc3RvcC1jb2xvcj0iIzU1NSIgc3RvcC1vcGFjaXR5PSIxIi8+PHN0b3Agb2ZZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzk5OSIgc3RvcC1vcGFjaXR5PSIxIi8+PC9saW5lYXJHcmFkaWVudD48ZmlsdGVyIGlkPSJkcm9wU2hhZG93Ij48ZmVEcm9wU2hhZG93IGR4PSIyIiBkeT0iNCIgc3RkRGV2aWF0aW9uPSIyIiBmbG9vZC1jb2xvcj0iIzAwMCIgZmxvb2Qtb3BhY2l0eT0iMC41Ii8+PC9maWx0ZXI+PC9kZWZzPjxwYXRoIGQ9Ik0gMjAsMjAgSCA3ODAgTCA3NjAsMTgwIEggNDAgWiIgZmlsbD0iIzBhMGEwYSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiIC8+PHBhdGggZD0iTSA2MCw0MCBMIDc0MCw0MCIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjEiIC8+PHBhdGggZD0iTSA2MCwxNjAgTCA3NDAsMTYwIiBzdHJva2U9IiMyMjIiIHN0cm9rZS13aWR0aD0iMSIgLz48ZyB0cmFuc2Zvcm09InNrZXdYKC0xMCkgdHJhbnNsYXRlKDUwLDEwKSI+PHRleHQgeD0iMzUwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LXNpemU9IjMwIiBmaWxsPSIjNzc3IiBsZXR0ZXItc3BhY2luZz0iMTAiPktBUkFQSVJPPC90ZXh0Pjx0ZXh0IHg9IjM1MCIgeT0iMTM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSI5MCIgZmlsbD0idXJsKCNtZXRhbEdyYWQpIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgbGV0dGVyLXNwYWNpbmc9Ii0yIiBmaWx0ZXI9InVybCgjZHJvcFNoYWRvdykiPkNBUlRFTDwvdGV4dD48cmVjdCB4PSIxNTAiIHk9IjE0NSIgd2lkdGg9IjQwMCIgaGVpZ2h0PSI4IiBmaWxsPSIjRDMyRjJGIiByeD0iMiIgLz48L2c+PHRleHQgeD0iNDAwIiB5PSIxNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNTU1IiBsZXR0ZXItc3BhY2luZz0iNCI+U1RBVEVISUdIV0FZU1BFRURTSE9QPC90ZXh0Pjwvc3ZnPg==';

// Alias for compatibility
export const BrandLogoIcon = KarapiroLogo;

export const HistoryIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 4v6h6"></path>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
  </svg>
);

export const DashboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
  </svg>
);

export const RaceDashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
     <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const EvoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
  </svg>
);

export const ChatIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

export const CameraIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

export const GearIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M12 1v2m0 18v2m8.3-15.7-.7.7m-13.2 0 .7.7m13.2 13.2-.7-.7m-13.2 0 .7-.7M4 12H2m20 0h-2m-9.7-8.3-.7-.7m0 13.2.7-.7"></path>
  </svg>
);


export const SlopeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M2 22h20L12 2 2 22zM12 12l6 6M6 18l6-6"></path>
    </svg>
);

export const GPRIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
       <path d="M3 3v18h18" />
       <path d="M20 7l-8 8-4-4-3 3" />
    </svg>
);


export const CoachIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="m9 12 2 2 4-4"></path>
    </svg>
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export const FusionIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 8V2" />
        <path d="M12 22v-6" />
        <path d="M16 12h6" />
        <path d="M2 12h6" />
        <path d="M4.93 19.07l4.24-4.24" />
        <path d="M14.83 9.17l4.24-4.24" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export const MicrophoneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
    </svg>
);

export const PinIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

export const SpeakerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
  </svg>
);

export const FollowIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="3"></circle>
        <line x1="12" y1="2" x2="12" y2="5"></line>
        <line x1="12" y1="19" x2="12" y2="22"></line>
        <line x1="2" y1="12" x2="5" y2="12"></line>
        <line x1="19" y1="12" x2="22" y2="12"></line>
    </svg>
);

export const FlagIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
        <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
);

export const RecordIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
  </svg>
);

export const ShareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
    <polyline points="16 6 12 2 8 6"></polyline>
    <line x1="12" y1="2" x2="12" y2="15"></line>
  </svg>
);

export const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

export const HudIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 7V4a2 2 0 0 1 2-2h3" />
      <path d="M17 2h3a2 2 0 0 1 2 2v3" />
      <path d="M22 17v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-3" />
      <path d="M12 7v10" />
      <path d="M7 12h10" />
    </svg>
);
