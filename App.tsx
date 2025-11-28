
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { VideoOverlay } from './components/VideoOverlay';
import { RunHistory } from './components/RunHistory';
import { CoachingModal } from './components/CoachingModal';
import { useTelemetry } from './hooks/useTelemetry';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useRecording } from './hooks/useRecording';
import { useTheme } from './hooks/useTheme';
import { RunSummary } from './types';
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
    isOBDConnected
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
  
  const prevIsLandscapeRef = useRef(false);

  // Platform Utility: Wake Lock Management
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
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning]);


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

  // --- Dynamic Background Rendering ---
  const renderBackground = () => {
      if (theme.backgroundStyle.type === 'carbon') {
          return (
              <div className="fixed inset-0 z-[-1]" style={{
                  backgroundColor: '#111',
                  backgroundImage: `
                    linear-gradient(27deg, #151515 5px, transparent 5px),
                    linear-gradient(207deg, #151515 5px, transparent 5px),
                    linear-gradient(90deg, #1b1b1b 10px, transparent 10px),
                    linear-gradient(90deg, #1d1d1d 10px, transparent 10px)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 10px 0, 10px -10px, 0px 10px'
              }}></div>
          );
      }
      if (theme.backgroundStyle.type === 'grid') {
          return (
              <div className="fixed inset-0 z-[-1] bg-purple-950/20" style={{
                  backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
                  backgroundSize: '40px 40px',
                  perspective: '500px',
              }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-900/50 to-transparent"></div>
              </div>
          );
      }
      if (theme.backgroundStyle.type === 'solid') {
          return <div className="fixed inset-0 z-[-1] bg-neutral-950"></div>;
      }
      // Default Nebula (implemented in CSS usually, but we override here if needed, or rely on index.html default for cyberpunk)
      return null; 
  };

  if (isLandscape && !manualOverride && activeView !== 'racedash' && activeView !== 'evodash') {
    return <FullscreenHud telemetryData={telemetryData} livePath={livePath} onExit={handleExitHud} />;
  }

  return (
    <div className={`h-screen flex flex-col items-center p-2 font-inter relative overflow-hidden ${theme.colors.bg.split('/')[0]}`}>
      {renderBackground()}
      
      <TranscriptOverlay 
        userTranscript={voiceState.userTranscript} 
        modelTranscript={voiceState.modelTranscript} 
        groundingChunks={voiceState.groundingChunks}
        isVisible={voiceState.isListening || voiceState.isSpeaking || !!voiceState.userTranscript || !!voiceState.modelTranscript} 
      />
      {recordingError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/80 text-white px-4 py-2 rounded-lg text-sm font-semibold z-50">
              {recordingError}
          </div>
      )}
      <div className="w-full max-w-7xl h-full flex flex-col relative">
        {/* Background Video Layer for Dashboard View */}
        {activeView === 'dashboard' && (
            <div className="absolute inset-0 z-0 rounded-lg overflow-hidden opacity-50">
                <VideoOverlay telemetryData={telemetryData} livePath={livePath} showHud={false} />
            </div>
        )}

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between p-3 w-full">
          <div className="flex items-center space-x-2">
            <BrandLogoIcon className={`w-32 h-auto -ml-1 ${theme.colors.icon}`} />
          </div>
          <div className={`flex items-center space-x-2 ${theme.colors.bg} rounded-full p-1 border ${theme.colors.border}`}>
            <div className="flex items-center space-x-1">
                {isLandscape && manualOverride && (
                    <button
                        onClick={() => setManualOverride(false)}
                        className={`p-2 rounded-full bg-opacity-20 ${theme.colors.primary} hover:bg-opacity-40 border border-opacity-50 animate-pulse`}
                    >
                        <HudIcon className="w-5 h-5" />
                    </button>
                )}
                <button
                onClick={() => setActiveView('dashboard')}
                className={`p-2 rounded-full transition-colors ${activeView === 'dashboard' ? `${theme.colors.primary} bg-white/10` : 'text-gray-400 hover:bg-white/5'}`}
                >
                <DashboardIcon className="w-5 h-5" />
                </button>
                 <button
                onClick={() => setActiveView('racedash')}
                className={`p-2 rounded-full transition-colors ${activeView === 'racedash' ? `${theme.colors.primary} bg-white/10` : 'text-gray-400 hover:bg-white/5'}`}
                >
                <RaceDashIcon className="w-5 h-5" />
                </button>
                <button
                onClick={() => setActiveView('evodash')}
                className={`p-2 rounded-full transition-colors ${activeView === 'evodash' ? `${theme.colors.primary} bg-white/10` : 'text-gray-400 hover:bg-white/5'}`}
                >
                <EvoIcon className="w-5 h-5" />
                </button>
                <button
                onClick={() => setActiveView('history')}
                className={`p-2 rounded-full transition-colors ${activeView === 'history' ? `${theme.colors.primary} bg-white/10` : 'text-gray-400 hover:bg-white/5'}`}
                >
                <HistoryIcon className="w-5 h-5" />
                </button>
                 <button
                onClick={() => setActiveView('chat')}
                className={`p-2 rounded-full transition-colors ${activeView === 'chat' ? `${theme.colors.primary} bg-white/10` : 'text-gray-400 hover:bg-white/5'}`}
                >
                <ChatIcon className="w-5 h-5" />
                </button>
            </div>
            <div className="flex items-center space-x-1 pl-1 border-l border-white/10">
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
                    className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-grow overflow-y-auto relative z-10 px-1 pb-2 ${activeView === 'racedash' || activeView === 'evodash' ? 'overflow-hidden' : ''}`}>
          {activeView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div className="space-y-2">
                <Dashboard 
                    telemetryData={telemetryData} 
                    livePath={livePath}
                    isCoachEnabled={isCoachEnabled}
                    isCoachSpeaking={isCoachSpeaking}
                    onToggleCoach={toggleRealtimeCoach}
                    lapData={lapData}
                />
              </div>
              <div className="space-y-2">
                <RaceMap 
                    data={livePath.length > 1 ? livePath : [{...telemetryData, position: {...telemetryData.position}}, { ...telemetryData, position: {lat: telemetryData.position.lat + 0.00001, long: telemetryData.position.long}}]} 
                    currentPosition={telemetryData.position}
                    showControls={true}
                    onSetStartFinish={setStartFinishLine}
                    startFinishLine={startFinishLine}
                />
              </div>
            </div>
          )}
          
          {activeView === 'racedash' && (
              <RaceDash telemetryData={telemetryData} lapData={lapData} />
          )}

          {activeView === 'evodash' && (
              <EvoRaceDash telemetryData={telemetryData} />
          )}

          {activeView === 'history' && <RunHistory runHistory={runHistory} onViewRun={handleViewRun} />}
          {activeView === 'chat' && <ChatView runHistory={runHistory} initialMessage={initialChatMessage} currentPosition={telemetryData.position} />}
        </main>

        <footer className="relative z-20 flex items-center justify-center p-3 w-full">
          <div className={`${theme.colors.bg} p-2 rounded-full border ${theme.colors.border}`}>
            <button
              onClick={handleStartStop}
              className={`relative px-12 py-4 text-xl font-orbitron font-bold rounded-full transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 overflow-hidden
              before:content-[''] before:absolute before:inset-0 before:opacity-20 before:bg-gradient-to-t before:from-white/50 before:to-transparent
              ${
                isRunning
                  ? 'bg-red-600/80 border border-red-400/50 text-white box-glow-red focus:ring-red-500/50'
                  : `${theme.colors.button} border ${theme.colors.border} text-white ${theme.colors.glow}`
              }`}
            >
              <span className="relative z-10 text-glow tracking-wider">{isRunning ? 'STOP RUN' : 'START RUN'}</span>
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
