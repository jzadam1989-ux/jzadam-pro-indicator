import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const LiveVoiceAssistant: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // For playback
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const playNextInQueue = () => {
    if (!audioContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    
    isPlayingRef.current = true;
    const buffer = playbackQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = playNextInQueue;
    source.start();
  };

  const handleAudioOutput = (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8);
    }
    
    const buffer = audioContextRef.current.createBuffer(1, bytes.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) {
      channelData[i] = bytes[i] / 32768.0;
    }
    
    playbackQueueRef.current.push(buffer);
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  };

  const connect = async () => {
    setIsConnecting(true);
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            processorRef.current!.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }
              
              let binary = '';
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Data = btoa(binary);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            sourceRef.current!.connect(processorRef.current!);
            processorRef.current!.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              handleAudioOutput(base64Audio);
            }
            
            if (message.serverContent?.interrupted) {
              playbackQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            disconnect();
          },
          onclose: () => {
            disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a professional Forex trading assistant. Keep your answers concise and helpful.",
        },
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (error) {
      console.error("Failed to connect:", error);
      setIsConnecting(false);
      disconnect();
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <Card className="bg-[#0a0a0a] border-zinc-800">
      <CardHeader className="border-b border-zinc-800 py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-blue-500" />
          Live Voice Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 flex flex-col items-center justify-center gap-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isConnected ? 'bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.5)]' : 'bg-zinc-800'}`}>
          {isConnecting ? (
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          ) : isConnected ? (
            <Mic className="w-10 h-10 text-blue-500 animate-pulse" />
          ) : (
            <MicOff className="w-10 h-10 text-zinc-500" />
          )}
        </div>
        
        <div className="text-center">
          <h3 className="text-lg font-medium text-zinc-200">
            {isConnecting ? 'Connecting...' : isConnected ? 'Listening...' : 'Voice Assistant'}
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            {isConnected ? 'Speak naturally to ask about the markets.' : 'Click to start a real-time voice conversation.'}
          </p>
        </div>
        
        <Button 
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting}
          className={`mt-4 w-full max-w-xs ${isConnected ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          {isConnected ? 'End Conversation' : 'Start Conversation'}
        </Button>
      </CardContent>
    </Card>
  );
};
