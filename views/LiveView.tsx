import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Power, Activity } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, PCM_SAMPLE_RATE, arrayBufferToBase64 } from '../utils/audio-processor';

const LiveView: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0); // For visualization
  const [error, setError] = useState<string | null>(null);

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Session Refs
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentSessionRef = useRef<any>(null); // To store the resolved session for closing

  const visualizerRef = useRef<HTMLDivElement>(null);

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (currentSessionRef.current) {
        currentSessionRef.current.close();
        currentSessionRef.current = null;
    }
    sessionPromiseRef.current = null;
    setIsConnected(false);
    setVolume(0);
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const connect = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE,
      });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Gemini Output Rate
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: 'You are a helpful, witty, and concise AI assistant named Nexus. Keep answers brief and conversational.',
        },
      };

      const sessionPromise = ai.live.connect({
        model: config.model,
        config: config.config,
        callbacks: {
          onopen: () => {
            console.log('Live Session Opened');
            setIsConnected(true);
            
            // Start Audio Streaming
            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            // Use ScriptProcessor for raw PCM access (AudioWorklet is better but more complex for a single file component)
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume calculation for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));

              if (isMuted) return;

              // Float32 to Int16 PCM conversion
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                 // Clamp and scale
                 const s = Math.max(-1, Math.min(1, inputData[i]));
                 int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              // Convert to base64
              const base64Data = arrayBufferToBase64(int16.buffer);

              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
               try {
                   const audioBytes = base64ToUint8Array(base64Audio);
                   const audioBuffer = await decodeAudioData(
                       audioBytes, 
                       outputAudioContextRef.current,
                       24000
                   );
                   
                   const source = outputAudioContextRef.current.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(outputAudioContextRef.current.destination);
                   
                   // Schedule playback
                   const currentTime = outputAudioContextRef.current.currentTime;
                   const startTime = Math.max(nextStartTimeRef.current, currentTime);
                   source.start(startTime);
                   nextStartTimeRef.current = startTime + audioBuffer.duration;
                   
               } catch (e) {
                   console.error("Audio decode error", e);
               }
            }
            
            // Handle Interruption (if user speaks over model)
            if (msg.serverContent?.interrupted) {
                console.log("Model interrupted");
                // In a full implementation, we would stop all currently playing sources here.
                // For simplicity, we just reset the time cursor.
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Session Closed");
            cleanup();
          },
          onerror: (e) => {
             console.error("Session Error", e);
             setError("Connection error. Please try again.");
             cleanup();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(sess => { currentSessionRef.current = sess; });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to access microphone or connect.");
      cleanup();
    }
  };

  const toggleConnection = () => {
    if (isConnected) {
      cleanup();
    } else {
      connect();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-950 p-6 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className={`absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950 transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-50'}`} />
      
      {/* Visualizer Circle */}
      <div className="relative z-10 flex flex-col items-center gap-12">
        <div className="relative group">
          {/* Outer Glow */}
          <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-300 ${
            isConnected ? 'bg-nexus-500/30' : 'bg-transparent'
          }`} style={{ transform: `scale(${1 + volume * 5})` }} />

          {/* Main Circle */}
          <div 
            onClick={toggleConnection}
            className={`w-40 h-40 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 border-4 shadow-2xl relative ${
              isConnected 
                ? 'border-nexus-400 bg-slate-900 shadow-nexus-500/50' 
                : error 
                  ? 'border-red-500/50 bg-slate-900 shadow-red-500/20'
                  : 'border-slate-700 bg-slate-800 hover:border-nexus-500/50 hover:bg-slate-700'
            }`}
          >
             {isConnected ? (
                 <Activity className={`w-16 h-16 text-nexus-400 transition-transform duration-100 ${
                     volume > 0.05 ? 'scale-110' : 'scale-100'
                 }`} />
             ) : (
                 <Power className={`w-16 h-16 ${error ? 'text-red-400' : 'text-slate-400 group-hover:text-nexus-400'}`} />
             )}
          </div>
          
          {/* Ripples when active */}
          {isConnected && (
            <>
              <div className="absolute inset-0 rounded-full border border-nexus-500/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <div className="absolute inset-0 rounded-full border border-nexus-500/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
            </>
          )}
        </div>

        <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">
                {isConnected ? 'Nexus Live' : 'Start Session'}
            </h2>
            <p className="text-slate-400 max-w-xs">
                {error ? (
                    <span className="text-red-400">{error}</span>
                ) : isConnected ? (
                    'Listening... Speak naturally.'
                ) : (
                    'Experience real-time, low-latency voice conversation powered by Gemini 2.5.'
                )}
            </p>
        </div>

        {/* Controls */}
        {isConnected && (
            <div className="flex gap-4">
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-4 rounded-full transition-colors ${
                        isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button 
                    onClick={cleanup}
                    className="p-4 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                    <Power className="w-6 h-6" />
                </button>
            </div>
        )}
      </div>
      
      {/* Frequency Bars Animation (Fake for aesthetics when speaking) */}
      {isConnected && volume > 0.01 && (
        <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center gap-1 opacity-30 pointer-events-none">
            {[...Array(20)].map((_, i) => (
                <div 
                    key={i} 
                    className="w-2 bg-nexus-400 rounded-t-full transition-all duration-75"
                    style={{ 
                        height: `${Math.random() * 100 * (1 + volume * 5)}%`,
                        animationDelay: `${i * 0.05}s`
                    }} 
                />
            ))}
        </div>
      )}
    </div>
  );
};

export default LiveView;