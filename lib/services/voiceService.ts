
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage, Blob } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.warn("Gemini API key not found. Voice features will be disabled.");
}

interface VoiceServiceCallbacks {
  onFunctionCall: (name: string, args: any) => void;
  onTranscriptUpdate: (transcript: string) => void;
  onError: (error: any) => void;
  onClose: () => void;
}

class VoiceService {
  private session: any | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;

  private functionDeclarations: FunctionDeclaration[] = [
    {
      name: 'startRun',
      description: 'Begins a new performance telemetry recording session.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
    {
      name: 'stopRun',
      description: 'Ends the current performance telemetry recording session.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
    {
      name: 'readoutMetric',
      description: 'Reads out a specific performance metric from the most recent run, such as "0-60", "quarter mile", "max speed", or "g-force".',
      parameters: { 
          type: Type.OBJECT, 
          properties: {
              metric: {
                  type: Type.STRING,
                  description: 'The specific metric to read out (e.g., "0-60", "quarter mile").'
              }
          },
          required: ['metric']
      },
    },
    {
        name: 'readoutCoachingAdvice',
        description: 'Reads out the AI-generated coaching advice for the most recent run.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'deleteLastRun',
        description: 'Deletes the data from the most recent performance run from the history.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
     {
        name: 'switchView',
        description: 'Switches the main application view.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                view: {
                    type: Type.STRING,
                    description: 'The view to switch to. Can be "dashboard", "history", or "chat".'
                }
            },
            required: ['view']
        }
    },
    {
        name: 'askChat',
        description: 'Ask a question about your run history or other telemetry data. Use this for analysis or comparison questions.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                question: {
                    type: Type.STRING,
                    description: 'The question the user is asking about their performance data.',
                },
            },
            required: ['question'],
        },
    },
    {
        name: 'askLocationQuestion',
        description: 'Ask a location-based question, like "where is the nearest gas station?" or "how far is it to the Golden Gate Bridge?". Use this for any queries involving places, directions, or geography.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                question: {
                    type: Type.STRING,
                    description: 'The location-based question the user is asking.',
                },
            },
            required: ['question'],
        },
    }
  ];

  async startSession(callbacks: VoiceServiceCallbacks): Promise<void> {
    if (!API_KEY) {
      callbacks.onError("API key not configured.");
      return;
    }
    if (this.session) {
        this.stopSession();
    }

    try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
        callbacks.onError("Microphone permission denied.");
        console.error("Error getting user media:", error);
        return;
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    let fullTranscript = '';
    
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                const source = this.audioContext.createMediaStreamSource(this.mediaStream!);
                this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
                
                this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const pcmBlob = this.createBlob(inputData);
                    sessionPromise.then((session) => {
                      session.sendRealtimeInput({ media: pcmBlob });
                    });
                };

                source.connect(this.scriptProcessor);
                this.scriptProcessor.connect(this.audioContext.destination);
            },
            onmessage: (message: LiveServerMessage) => {
                if(message.toolCall) {
                    message.toolCall.functionCalls.forEach(fc => {
                        callbacks.onFunctionCall(fc.name, fc.args);
                    });
                }
                
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    fullTranscript += text;
                    callbacks.onTranscriptUpdate(fullTranscript);
                }

                if (message.serverContent?.turnComplete) {
                    fullTranscript = '';
                }
            },
            onerror: (e: ErrorEvent) => {
                console.error('Live session error:', e);
                callbacks.onError(e);
                this.stopSession();
            },
            onclose: () => {
                callbacks.onClose();
                this.stopSession();
            },
        },
        config: {
            responseModalities: [Modality.AUDIO], // API requires AUDIO modality, even if we use a separate TTS for output.
            tools: [{ functionDeclarations: this.functionDeclarations }],
            inputAudioTranscription: {},
            systemInstruction: 'You are a hands-free AI assistant for a car telemetry app called Genesis. Your goal is to execute user commands. Be concise. Prefer to call functions over answering directly. For questions about performance data, use the askChat function.'
        }
    });
    this.session = await sessionPromise;
  }

  stopSession() {
    this.session?.close();
    this.session = null;
    
    this.scriptProcessor?.disconnect();
    this.scriptProcessor = null;

    this.audioContext?.close();
    this.audioContext = null;

    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = null;
  }

  private createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: this.encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const voiceService = new VoiceService();
