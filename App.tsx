
import React, { useState, useCallback, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { VideoOverlay } from './components/VideoOverlay';
import { RunHistory } from './components/RunHistory';
import { CoachingModal } from './components/CoachingModal';
import { useTelemetry } from './hooks/useTelemetry';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useRecording } from './hooks/useRecording';
import { RunSummary } from './types';
import { BrandLogoIcon, HistoryIcon, DashboardIcon, ChatIcon } from './components/icons';
import { RaceMap } from './components/RaceMap';
import { VoiceControl } from './components/VoiceControl';
import { TranscriptOverlay } from './components/TranscriptOverlay';
import { ChatView } from './components/ChatView';
import { FullscreenHud } from './components/FullscreenHud';
import { RecordingControl } from './components/RecordingControl';
import { RecordingModal } from './components/RecordingModal';

type View = 'dashboard' | 'history' | 'chat';

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
  } = useTelemetry();

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

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', checkOrientation);
    checkOrientation(); 

    return () => window.removeEventListener('resize', checkOrientation);
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
    setActiveView,
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

  if (isLandscape) {
    return <FullscreenHud telemetryData={telemetryData} livePath={livePath} />;
  }

  return (
    <div className="h-screen bg-transparent flex flex-col items-center p-2 font-inter relative overflow-hidden">
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
        {activeView === 'dashboard' && (
            <div className="absolute inset-0 z-0 rounded-lg overflow-hidden">
                <VideoOverlay telemetryData={telemetryData} livePath={livePath} showHud={false} />
            </div>
        )}
        <header className="relative z-20 flex items-center justify-between p-3 w-full">
          <div className="flex items-center space-x-2">
            <BrandLogoIcon className="w-32 h-auto -ml-1" />
          </div>
          <div className="flex items-center space-x-2 glass-pane rounded-full p-1">
            <div className="flex items-center space-x-1">
                <button
                onClick={() => setActiveView('dashboard')}
                className={`p-2 rounded-full transition-colors ${activeView === 'dashboard' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:bg-slate-700/50'}`}
                aria-label="Dashboard View"
                >
                <DashboardIcon className="w-5 h-5" />
                </button>
                <button
                onClick={() => setActiveView('history')}
                className={`p-2 rounded-full transition-colors ${activeView === 'history' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:bg-slate-700/50'}`}
                aria-label="Run History View"
                >
                <HistoryIcon className="w-5 h-5" />
                </button>
                 <button
                onClick={() => setActiveView('chat')}
                className={`p-2 rounded-full transition-colors ${activeView === 'chat' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:bg-slate-700/50'}`}
                aria-label="AI Chat View"
                >
                <ChatIcon className="w-5 h-5" />
                </button>
            </div>
            <div className="flex items-center space-x-1 pl-1 border-l border-slate-600/50">
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
            </div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto relative z-10 px-1 pb-2">
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
          {activeView === 'history' && <RunHistory runHistory={runHistory} onViewRun={handleViewRun} />}
          {activeView === 'chat' && <ChatView runHistory={runHistory} initialMessage={initialChatMessage} currentPosition={telemetryData.position} />}
        </main>

        <footer className="relative z-20 flex items-center justify-center p-3 w-full">
          <div className="glass-pane p-2 rounded-full">
            <button
              onClick={handleStartStop}
              className={`relative px-12 py-4 text-xl font-orbitron font-bold rounded-full transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 overflow-hidden
              before:content-[''] before:absolute before:inset-0 before:opacity-20 before:bg-gradient-to-t before:from-white/50 before:to-transparent
              ${
                isRunning
                  ? 'bg-red-600/80 border border-red-400/50 text-white box-glow-red focus:ring-red-500/50'
                  : 'bg-cyan-500/80 border border-cyan-300/50 text-white box-glow-cyan focus:ring-cyan-500/50'
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
    </div>
  );
};

export default App;
