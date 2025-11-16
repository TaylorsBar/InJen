
import { useState, useCallback, useRef, useEffect } from 'react';
import { voiceService } from '../services/voiceService';
import { speak } from '../services/ttsService';
import { getGroundedResponse } from '../services/geminiService';
import { RunSummary } from '../types';
import { MPS_PER_MPH } from '../constants';

type View = 'dashboard' | 'history' | 'chat';

interface VoiceCommandActions {
  startRun: () => void;
  stopRun: () => void;
  getLatestRun: () => RunSummary | null;
  currentPosition: { lat: number; long: number };
  deleteLastRun: () => void;
  setActiveView: (view: View) => void;
  sendChatMessage: (message: string) => void;
}

export const useVoiceCommands = (actions: VoiceCommandActions) => {
  const [voiceState, setVoiceState] = useState({
    isListening: false,
    isSpeaking: false,
    userTranscript: '',
    modelTranscript: '',
    groundingChunks: [] as any[],
  });
   const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');


  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (navigator.permissions?.query) {
        navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
            setMicPermission(permissionStatus.state);
            permissionStatus.onchange = () => {
                setMicPermission(permissionStatus.state);
            };
        });
    }
  }, []);

  const handleFunctionCall = useCallback(async (name: string, args: any) => {
    let responseText = "OK.";
    setVoiceState(prev => ({ ...prev, userTranscript: '', isListening: false, groundingChunks: [] }));

    const lastRun = actionsRef.current.getLatestRun();

    switch (name) {
      case 'startRun':
        actionsRef.current.startRun();
        responseText = 'Starting a new run.';
        break;
      case 'stopRun':
        actionsRef.current.stopRun();
        responseText = 'Stopping the run. Analyzing data now.';
        break;
      case 'readoutMetric':
        if (!lastRun) {
            responseText = 'No run data is available.';
            break;
        }
        const metric = args.metric?.toLowerCase() || '';
        if (metric.includes('0-60') || metric.includes('zero to sixty')) {
            responseText = `0 to 60 was ${lastRun.zeroToSixty ? lastRun.zeroToSixty.toFixed(2) + ' seconds' : 'not achieved'}.`;
        } else if (metric.includes('quarter mile')) {
            responseText = `Quarter mile time was ${lastRun.quarterMileTime ? lastRun.quarterMileTime.toFixed(2) + ' seconds' : 'not available'}.`;
        } else if (metric.includes('max speed') || metric.includes('top speed')) {
            responseText = `Max speed was ${(lastRun.maxSpeed / MPS_PER_MPH).toFixed(1)} miles per hour.`;
        } else if (metric.includes('g-force')) {
            responseText = `Max longitudinal G-force was ${lastRun.maxGForce.longitudinal.toFixed(2)}g.`;
        } else {
            responseText = "Sorry, I don't recognize that metric. You can ask for 0-60, quarter mile, max speed, or G-force.";
        }
        break;
      case 'readoutCoachingAdvice':
        if (lastRun?.coachingAdvice) {
          responseText = `Here is the last coaching advice: ${lastRun.coachingAdvice}`;
        } else {
          responseText = 'No coaching advice is available for the last run.';
        }
        break;
      case 'deleteLastRun':
        if (lastRun) {
          actionsRef.current.deleteLastRun();
          responseText = 'The last run has been deleted.';
        } else {
          responseText = 'There are no runs to delete.';
        }
        break;
      case 'switchView':
        const view = args.view?.toLowerCase();
        if (view === 'history' || view === 'dashboard' || view === 'chat') {
            actionsRef.current.setActiveView(view as View);
            responseText = `Switching to ${view} view.`;
        } else {
            responseText = `Sorry, I can't switch to the ${view} view.`;
        }
        break;
      case 'askChat':
        if (args.question) {
            actionsRef.current.sendChatMessage(args.question);
            // No spoken response needed, the chat view will handle it.
            setVoiceState(prev => ({ ...prev, isSpeaking: false }));
            return;
        }
        responseText = "What would you like to ask?";
        break;
       case 'askLocationQuestion':
        setVoiceState(prev => ({ ...prev, modelTranscript: 'Searching...', isSpeaking: true }));
        const groundedResponse = await getGroundedResponse(args.question || '', actionsRef.current.currentPosition);
        responseText = groundedResponse.text;
        setVoiceState(prev => ({ ...prev, modelTranscript: responseText, groundingChunks: groundedResponse.chunks, isSpeaking: true }));
        await speak(responseText);
        setVoiceState(prev => ({ ...prev, isSpeaking: false }));
        return; // Use return to skip the default speak call at the end
      default:
        responseText = "Sorry, I don't know how to do that.";
    }

    setVoiceState(prev => ({ ...prev, modelTranscript: responseText, isSpeaking: true }));
    await speak(responseText);
    setVoiceState(prev => ({ ...prev, isSpeaking: false }));
  }, []);
  
  const handleTranscriptUpdate = useCallback((transcript: string) => {
    setVoiceState(prev => ({...prev, userTranscript: transcript}));
  }, []);

  const toggleListening = useCallback(async () => {
    if (micPermission === 'denied') {
        setVoiceState(prev => ({ ...prev, isListening: false, isSpeaking: false, modelTranscript: '', userTranscript: 'Microphone permission denied in browser settings.' }));
        return;
    }
    
    if (voiceState.isListening) {
      voiceService.stopSession();
      setVoiceState(prev => ({ ...prev, isListening: false, userTranscript: '' }));
    } else {
       setVoiceState(prev => ({ ...prev, isListening: true, userTranscript: 'Listening...', modelTranscript: '', groundingChunks: [] }));
      try {
        await voiceService.startSession({
            onFunctionCall: handleFunctionCall,
            onTranscriptUpdate: handleTranscriptUpdate,
            onError: (error) => {
                console.error('Voice service error:', error);
                setVoiceState(prev => ({...prev, isListening: false, userTranscript: 'Voice service error.'}));
            },
            onClose: () => {
                setVoiceState(prev => ({ ...prev, isListening: false, userTranscript: '' }));
            }
        });
      } catch (error) {
        console.error("Failed to start voice session:", error);
        setVoiceState(prev => ({...prev, isListening: false, userTranscript: 'Could not start voice service.'}));
      }
    }
  }, [voiceState.isListening, handleFunctionCall, handleTranscriptUpdate, micPermission]);

  useEffect(() => {
    return () => {
        voiceService.stopSession();
    };
  }, []);

  return { voiceState, toggleListening, isMicBlocked: micPermission === 'denied' };
};
