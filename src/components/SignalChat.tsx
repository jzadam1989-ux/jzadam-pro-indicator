import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";
import { Signal, CandlestickData } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, Bot, User, TrendingUp, TrendingDown, Sparkles, Paperclip, X, Volume2, BrainCircuit } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  type?: 'signal' | 'text';
  signal?: Signal;
  image?: string; // base64
}

interface SignalChatProps {
  signals: Signal[];
  currentData: CandlestickData[];
  selectedPair: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const SignalChat: React.FC<SignalChatProps> = ({ signals, currentData, selectedPair }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSignalTime = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Add initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Welcome to the CTI Signal Analysis Chat. I'm your AI trading assistant. I'll monitor ${selectedPair} and provide insights on trade signals.`,
        timestamp: Date.now(),
      }]);
    }
  }, []);

  // Monitor for new signals and add them to chat
  useEffect(() => {
    if (signals.length > 0) {
      const latestSignal = signals[signals.length - 1];
      if (latestSignal.time > lastSignalTime.current) {
        lastSignalTime.current = latestSignal.time;
        
        const signalMessage: Message = {
          id: `signal-${latestSignal.time}`,
          role: 'system',
          content: `${latestSignal.type} Signal detected for ${selectedPair} at ${latestSignal.price.toFixed(5)}`,
          timestamp: latestSignal.time * 1000,
          type: 'signal',
          signal: latestSignal,
        };
        
        setMessages(prev => [...prev, signalMessage]);
        
        // Automatically ask AI to analyze the signal
        analyzeSignal(latestSignal);
      }
    }
  }, [signals]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const playTTS = async (text: string, messageId: string) => {
    if (playingAudioId === messageId) {
      // Stop playing
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    try {
      setPlayingAudioId(messageId);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        if (audioSourceRef.current) {
          audioSourceRef.current.stop();
        }

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
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setPlayingAudioId(null);
        source.start();
        audioSourceRef.current = source;
      } else {
        setPlayingAudioId(null);
      }
    } catch (error) {
      console.error('TTS failed:', error);
      setPlayingAudioId(null);
    }
  };

  const analyzeSignal = async (signal: Signal) => {
    setIsLoading(true);
    try {
      const prompt = `Analyze this Forex ${signal.type} signal for ${selectedPair}:
      Entry Price: ${signal.price.toFixed(5)}
      Take Profit: ${signal.takeProfit.toFixed(5)}
      Stop Loss: ${signal.stopLoss.toFixed(5)}
      Reason: ${signal.reason}
      Time: ${format(signal.time * 1000, 'HH:mm:ss')}
      
      Provide a brief (2-3 sentences) professional analysis of why this signal is significant and what traders should look for next. Comment briefly on the risk/reward ratio based on the TP/SL levels. Keep it concise and technical.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const aiMessage: Message = {
        id: `ai-analysis-${Date.now()}`,
        role: 'assistant',
        content: response.text || "I'm analyzing the market conditions for this signal...",
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI Analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
      image: selectedImage || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const marketContext = currentData.length > 0 
        ? `Current Price: ${currentData[currentData.length - 1].close.toFixed(5)}. Recent signals: ${signals.slice(-3).map(s => `${s.type} at ${s.price}`).join(', ')}.`
        : '';

      const systemPrompt = `Context: You are a professional Forex trading assistant for the CTI Pro platform. 
      Market: ${selectedPair}
      ${marketContext}
      
      Provide a helpful, professional, and concise response. Focus on technical analysis and market sentiment.`;

      // Format history for the model
      const historyParts: any[] = messages.filter(m => m.role !== 'system').map(m => {
        const parts: any[] = [{ text: m.content }];
        if (m.image) {
          const base64Data = m.image.split(',')[1];
          const mimeType = m.image.split(';')[0].split(':')[1];
          parts.push({ inlineData: { data: base64Data, mimeType } });
        }
        return { role: m.role === 'user' ? 'user' : 'model', parts };
      });

      const currentParts: any[] = [{ text: `${systemPrompt}\n\nUser Question: ${currentInput}` }];
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.split(';')[0].split(':')[1];
        currentParts.push({ inlineData: { data: base64Data, mimeType } });
      }

      const contents = [...historyParts, { role: 'user', parts: currentParts }];

      const model = isThinking || currentImage ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      const config: any = {};
      
      if (isThinking) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const aiMessage: Message = {
        id: `ai-resp-${Date.now()}`,
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't process that request.",
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI Response failed:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting to my analysis engine. Please try again in a moment.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-[#0a0a0a] border-zinc-800 flex flex-col h-[600px]">
      <CardHeader className="border-b border-zinc-800 py-3 px-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-zinc-400" />
          <CardTitle className="text-sm font-medium">Signal Analysis Chat</CardTitle>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="thinking-mode" 
              checked={isThinking}
              onCheckedChange={setIsThinking}
              className="data-[state=checked]:bg-purple-500"
            />
            <Label htmlFor="thinking-mode" className="text-xs text-zinc-400 flex items-center gap-1 cursor-pointer">
              <BrainCircuit className="w-3 h-3" />
              Deep Analysis
            </Label>
          </div>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 text-[10px]">
            <Sparkles className="w-3 h-3" />
            AI Powered
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant' ? 'bg-zinc-800' : 
                  msg.role === 'system' ? 'bg-blue-500/10' : 'bg-zinc-100'
                }`}>
                  {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-zinc-400" /> : 
                   msg.role === 'system' ? <TrendingUp className="w-4 h-4 text-blue-500" /> : 
                   <User className="w-4 h-4 text-black" />}
                </div>
                
                <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                  {msg.type === 'signal' && msg.signal ? (
                    <div className={`p-3 rounded-lg border ${
                      msg.signal.type === 'BUY' 
                        ? 'bg-green-500/5 border-green-500/20' 
                        : 'bg-red-500/5 border-red-500/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {msg.signal.type === 'BUY' ? (
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          msg.signal.type === 'BUY' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {msg.signal.type} SIGNAL
                        </span>
                      </div>
                      <p className="text-xs font-medium text-zinc-200">
                        {selectedPair} at {msg.signal.price.toFixed(5)}
                      </p>
                      <div className="flex gap-3 mt-1.5">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-500 uppercase">TP</span>
                          <span className="text-[10px] font-mono text-green-500">{msg.signal.takeProfit.toFixed(5)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-500 uppercase">SL</span>
                          <span className="text-[10px] font-mono text-red-500">{msg.signal.stopLoss.toFixed(5)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">{msg.signal.reason}</p>
                    </div>
                  ) : (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed relative group ${
                      msg.role === 'user' 
                        ? 'bg-zinc-100 text-black' 
                        : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                    }`}>
                      {msg.image && (
                        <img src={msg.image} alt="Uploaded chart" className="max-w-full rounded-md mb-2 border border-zinc-200/20" />
                      )}
                      {msg.content}
                      
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => playTTS(msg.content, msg.id)}
                          className={`absolute -right-8 top-2 p-1.5 rounded-full transition-opacity ${playingAudioId === msg.id ? 'bg-blue-500/20 text-blue-500 opacity-100' : 'bg-zinc-800 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-200'}`}
                          title={playingAudioId === msg.id ? "Stop Audio" : "Read Aloud"}
                        >
                          <Volume2 size={14} className={playingAudioId === msg.id ? "animate-pulse" : ""} />
                        </button>
                      )}
                    </div>
                  )}
                  <span className="text-[9px] text-zinc-600 px-1">
                    {format(msg.timestamp, 'HH:mm')}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-zinc-400 animate-pulse" />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/20">
          {selectedImage && (
            <div className="relative inline-block mb-2">
              <img src={selectedImage} alt="Preview" className="h-16 rounded border border-zinc-700" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <Button 
              type="button" 
              size="icon" 
              variant="outline"
              className="h-9 w-9 border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about market analysis or upload a chart..."
              className="bg-zinc-900 border-zinc-800 text-xs h-9 focus-visible:ring-zinc-700"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-9 w-9 bg-zinc-100 text-black hover:bg-zinc-200"
              disabled={isLoading || (!input.trim() && !selectedImage)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
