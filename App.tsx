
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { VideoOverlay } from './components/VideoOverlay';
import { RunHistory } from './components/RunHistory';
import { CoachingModal } from './components/CoachingModal';
import { useTelemetry } from './hooks/useTelemetry';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useRecording } from './hooks/useRecording';
import { useTheme } from './hooks/useTheme';
import { BrandLogoIcon, HistoryIcon, DashboardIcon, ChatIcon, SettingsIcon, HudIcon, RaceDashIcon, EvoIcon } from './components/icons';
import { RaceMap } from './components/RaceMap';
import { VoiceControl } from './components/VoiceControl';
import { TranscriptOverlay } from './components/TranscriptOverlay';
import { ChatView } from './components/ChatView';
import { FullscreenHud } from './components/FullscreenHud';
import { RecordingControl } from './components/RecordingControl';
import { RecordingModal } from './components/RecordingModal';
import { ToolsModal } from './components/ToolsModal';
import { RaceDash } from './components/RaceDash';
import { EvoRaceDash } from './components/EvoRaceDash';
import { platformService } from './services/platformService';
import { SensorPermissionModal } from './components/SensorPermissionModal';
import { RunSummary } from './types';

type View = 'dashboard' | 'history' | 'chat' | 'racedash' | 'evodash';

const App: React.FC = () => {
  const {
    isRunning,
    telemetryData,
    livePath,
    runHistory,
    coaching,
    startRun,
    stopRun,
    setRunHistory,
    isCoachEnabled,
    isCoachSpeaking,
    toggleRealtimeCoach,
    lapData,
    setStartFinishLine,
    startFinishLine,
    connectOBD,
    disconnectOBD,
    isOBDConnected,
    enableSensors,
    isSensorsEnabled
  } = useTelemetry();

  const { theme } = useTheme();

  const {
      status: recordingStatus,
      videoUrl: recordedVideoUrl,
      timer: recordingTimer,
      error: recordingError,
      startRecording,
      stopRecording,
      discardRecording
  } = useRecording();

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);
  const [initialChatMessage, setInitialChatMessage] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSensorPermission, setShowSensorPermission] = useState(false);
  
  const prevIsLandscapeRef = useRef(false);

  // Platform Utility: Wake Lock Management & Permission Check
  useEffect(() => {
    const manageWakeLock = async () => {
      if (isRunning) {
        await platformService.requestWakeLock();
      } else {
        await platformService.releaseWakeLock();
      }
    };
    manageWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        platformService.requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check for iOS permissions
    if (platformService.requiresMotionPermission() && !isSensorsEnabled) {
        // Delay slightly to ensure app is interactive
        setTimeout(() => setShowSensorPermission(true), 1000);
    } else {
        // Non-iOS: Enable immediately
        enableSensors();
    }

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, isSensorsEnabled, enableSensors]);


  useEffect(() => {
    const checkOrientation = () => {
        let newIsLandscape = false;
        if (window.screen && window.screen.orientation) {
             newIsLandscape = window.screen.orientation.type.includes('landscape');
        } else {
             newIsLandscape = window.innerWidth > window.innerHeight;
        }

        setIsLandscape(newIsLandscape);

        if (newIsLandscape !== prevIsLandscapeRef.current) {
            setManualOverride(false);
        }
        prevIsLandscapeRef.current = newIsLandscape;
    };

    const handleOrientationChangeEvent = () => {
         checkOrientation();
    };

    window.addEventListener('resize', checkOrientation);
    if (window.screen && window.screen.orientation) {
        window.screen.orientation.addEventListener('change', handleOrientationChangeEvent);
    }
    
    checkOrientation(); 

    return () => {
        window.removeEventListener('resize', checkOrientation);
        if (window.screen && window.screen.orientation) {
            window.screen.orientation.removeEventListener('change', handleOrientationChangeEvent);
        }
    };
  }, []);

  const handleExitHud = useCallback(async () => {
      setManualOverride(true);
      await platformService.exitFullscreen();
  }, []);


  const deleteLastRun = useCallback(() => {
    setRunHistory(prev => prev.slice(0, -1));
  }, [setRunHistory]);

  const sendChatMessageAndSwitch = useCallback((message: string) => {
    setInitialChatMessage(message);
    setActiveView('chat');
    setTimeout(() => setInitialChatMessage(null), 100);
  }, []);

  const { voiceState, toggleListening, isMicBlocked } = useVoiceCommands({
    startRun,
    stopRun,
    getLatestRun: () => runHistory.length > 0 ? runHistory[runHistory.length - 1] : null,
    currentPosition: telemetryData.position,
    deleteLastRun,
    setActiveView: (view: any) => setActiveView(view),
    sendChatMessage: sendChatMessageAndSwitch,
  });

  const handleStartStop = () => {
    if (isRunning) {
      stopRun();
    } else {
      startRun();
    }
  };

  const handleViewRun = (run: RunSummary) => {
    setSelectedRun(run);
  };

  const handleCloseModal = () => {
      coaching.clear();
      setSelectedRun(null);
  }
  
  const handleSensorPermissionGranted = () => {
      enableSensors();
      setShowSensorPermission(false);
  }

  // --- Dynamic Background Rendering ---
  const renderBackground = () => {
      if (theme.backgroundStyle.type === 'carbon') {
          return (
              <div className="fixed inset-0 z-[-1]" style={{
                  backgroundColor: '#0a0a0a',
                  backgroundImage: `
                    radial-gradient(circle at 50% 0%, #1a1a1a 0%, transparent 60%),
                    linear-gradient(27deg, #111 5px, transparent 5px),
                    linear-gradient(207deg, #111 5px, transparent 5px),
                    linear-gradient(90deg, #161616 10px, transparent 10px),
                    linear-gradient(90deg, #161616 10px, transparent 10px)
                  `,
                  backgroundSize: '100% 100%, 20px 20px, 20px 20px, 20px 20px, 20px 20px',
                  backgroundPosition: '0 0, 0 0, 10px 0, 10px -10px, 0px 10px'
              }}></div>
          );
      }
      if (theme.backgroundStyle.type === 'grid') {
          return (
              <div className="fixed inset-0 z-[-1] bg-[#0f0518]" style={{
                  backgroundImage: `
                    linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '40px 40px',
                  perspective: '500px',
              }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f0518] via-transparent to-transparent"></div>
              </div>
          );
      }
      if (theme.backgroundStyle.type === 'solid') {
          return <div className="fixed inset-0 z-[-1] bg-[#050505]"></div>;
      }
      // Cyberpunk default
      return null; 
  };

  if (isLandscape && !manualOverride && activeView !== 'racedash' && activeView !== 'evodash') {
    return <FullscreenHud telemetryData={telemetryData} livePath={livePath} onExit={handleExitHud} />;
  }

  const NavButton = ({ view, icon, active, label }: { view: View, icon: React.ReactNode, active: boolean, label?: string }) => (
      <button
        onClick={() => setActiveView(view)}
        title={label}
        className={`relative p-2 sm:p-2.5 rounded-xl transition-all duration-300 group shrink-0 ${active 
            ? `${theme.colors.bg} text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20` 
            : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
      >
        {icon}
        {active && (
            <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${theme.colors.button} shadow-[0_0_8px_currentColor]`}></span>
        )}
      </button>
  );

  return (
    <div className={`h-screen flex flex-col items-center p-2 font-inter relative overflow-hidden ${theme.colors.bg.split('/')[0]} selection:bg-cyan-500/30 selection:text-white`}>
      {renderBackground()}
      
      {showSensorPermission && (
          <SensorPermissionModal 
            onGranted={handleSensorPermissionGranted} 
            onSkipped={() => setShowSensorPermission(false)} 
          />
      )}

      <TranscriptOverlay 
        userTranscript={voiceState.userTranscript} 
        modelTranscript={voiceState.modelTranscript} 
        groundingChunks={voiceState.groundingChunks}
        isVisible={voiceState.isListening || voiceState.isSpeaking || !!voiceState.userTranscript || !!voiceState.modelTranscript} 
      />
      {recordingError && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur text-white px-6 py-3 rounded-full text-sm font-bold shadow-xl z-50 animate-in fade-in slide-in-from-top-4 border border-red-400/30">
              {recordingError}
          </div>
      )}
      <div className="w-full max-w-7xl h-full flex flex-col relative">
        {/* Background Video Layer for Dashboard View */}
        {activeView === 'dashboard' && (
            <div className="absolute inset-0 z-0 rounded-2xl overflow-hidden opacity-30 mask-image-gradient">
                <VideoOverlay telemetryData={telemetryData} livePath={livePath} showHud={false} />
            </div>
        )}

        {/* Floating Command Bar (Header) */}
        <header className="relative z-30 flex items-center justify-between px-2 sm:px-3 py-3 w-full shrink-0 gap-2">
          {/* Logo Section */}
          <div className="flex items-center shrink-0">
            <BrandLogoIcon className={`w-28 sm:w-40 h-auto drop-shadow-2xl ${theme.colors.icon}`} />
          </div>
          
          {/* Nav Section */}
          <div className={`flex items-center gap-1 sm:gap-2 glass-pane rounded-2xl p-1.5 border ${theme.colors.border} shadow-2xl backdrop-blur-xl overflow-x-auto max-w-full`} style={{ scrollbarWidth: 'none' }}>
            <div className="flex items-center shrink-0">
                {isLandscape && manualOverride && (
                    <button
                        onClick={() => setManualOverride(false)}
                        className={`p-2 sm:p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 animate-pulse mr-2 shrink-0`}
                        title="Return to HUD"
                    >
                        <HudIcon className="w-5 h-5" />
                    </button>
                )}
                <NavButton view="dashboard" icon={<DashboardIcon className="w-5 h-5" />} active={activeView === 'dashboard'} label="Dashboard" />
                <NavButton view="racedash" icon={<RaceDashIcon className="w-5 h-5" />} active={activeView === 'racedash'} label="Race Dash" />
                <NavButton view="evodash" icon={<EvoIcon className="w-5 h-5" />} active={activeView === 'evodash'} label="Evo Dash" />
                <NavButton view="history" icon={<HistoryIcon className="w-5 h-5" />} active={activeView === 'history'} label="History" />
                <NavButton view="chat" icon={<ChatIcon className="w-5 h-5" />} active={activeView === 'chat'} label="AI Chat" />
            </div>
            
            <div className="w-px h-6 bg-white/10 mx-1 shrink-0"></div>

            <div className="flex items-center gap-1 shrink-0">
                <RecordingControl
                    status={recordingStatus}
                    timer={recordingTimer}
                    onStart={startRecording}
                    onStop={stopRecording}
                />
                <VoiceControl
                  isListening={voiceState.isListening}
                  isSpeaking={voiceState.isSpeaking}
                  isDisabled={isMicBlocked}
                  onClick={toggleListening}
                />
                <button
                    onClick={() => setShowTools(true)}
                    className="p-2 sm:p-2.5 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-300 shrink-0"
                    title="Settings"
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-grow overflow-y-auto relative z-10 px-1 pb-2 ${activeView === 'racedash' || activeView === 'evodash' ? 'overflow-hidden' : ''} scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10`}>
          {activeView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full content-start">
              <div className="space-y-3">
                <Dashboard 
                    telemetryData={telemetryData} 
                    livePath={livePath}
                    isCoachEnabled={isCoachEnabled}
                    isCoachSpeaking={isCoachSpeaking}
                    onToggleCoach={toggleRealtimeCoach}
                    lapData={lapData}
                />
              </div>
              <div className="space-y-3 flex flex-col h-full">
                <div className="glass-pane rounded-2xl p-1 border border-white/5 shadow-2xl flex-grow min-h-[300px] relative overflow-hidden group">
                    <RaceMap 
                        data={livePath.length > 1 ? livePath : [{...telemetryData, position: {...telemetryData.position}}, { ...telemetryData, position: {lat: telemetryData.position.lat + 0.00001, long: telemetryData.position.long}}]} 
                        currentPosition={telemetryData.position}
                        showControls={true}
                        onSetStartFinish={setStartFinishLine}
                        startFinishLine={startFinishLine}
                        className="rounded-xl"
                    />
                    {/* Map Vignette */}
                    <div className="absolute inset-0 pointer-events-none rounded-xl shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>
                </div>
              </div>
            </div>
          )}
          
          {activeView === 'racedash' && (
              <div className="h-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                  <RaceDash telemetryData={telemetryData} lapData={lapData} />
              </div>
          )}

          {activeView === 'evodash' && (
              <div className="h-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-black">
                  <EvoRaceDash telemetryData={telemetryData} />
              </div>
          )}

          {activeView === 'history' && <RunHistory runHistory={runHistory} onViewRun={handleViewRun} />}
          {activeView === 'chat' && <ChatView runHistory={runHistory} initialMessage={initialChatMessage} currentPosition={telemetryData.position} />}
        </main>

        {/* Footer Control Deck */}
        <footer className="relative z-30 flex items-center justify-center pb-4 pt-2 w-full shrink-0">
          <div className="relative group">
            {/* Glow Effect */}
            <div className={`absolute -inset-1 rounded-full opacity-70 blur-md transition-all duration-500 group-hover:opacity-100 ${isRunning ? 'bg-red-600' : 'bg-cyan-500'}`}></div>
            
            <button
              onClick={handleStartStop}
              className={`relative flex items-center gap-3 px-8 py-3 rounded-full border-2 transition-all duration-300 transform active:scale-95 shadow-2xl
              ${isRunning 
                ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-400 text-white' 
                : 'bg-gradient-to-b from-cyan-600 to-cyan-800 border-cyan-400 text-white'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-red-200 animate-pulse' : 'bg-cyan-200 shadow-[0_0_10px_white]'}`}></div>
              <span className="font-orbitron font-bold text-lg tracking-widest uppercase">
                  {isRunning ? 'STOP ENGINE' : 'START ENGINE'}
              </span>
            </button>
          </div>
        </footer>
      </div>

      {(coaching.isLoading || coaching.advice || selectedRun) && (
        <CoachingModal
          isLoading={coaching.isLoading && !selectedRun}
          onClose={handleCloseModal}
          runSummary={selectedRun || (runHistory.length > 0 ? runHistory[runHistory.length - 1] : null) }
        />
      )}

      {recordingStatus === 'stopped' && (
        <RecordingModal 
          videoUrl={recordedVideoUrl}
          onClose={discardRecording}
        />
      )}

      {showTools && (
          <ToolsModal 
            onClose={() => setShowTools(false)} 
            runHistory={runHistory}
            connectOBD={connectOBD}
            disconnectOBD={disconnectOBD}
            isOBDConnected={isOBDConnected}
          />
      )}
    </div>
  );
};

export default App;
