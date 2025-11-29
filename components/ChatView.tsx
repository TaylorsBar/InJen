
import React, { useState, useEffect, useRef } from 'react';
import { RunSummary } from '../types';
import { chatService } from '../services/chatService';
import { ChatIcon, PinIcon } from './icons';
import { useTheme } from '../hooks/useTheme';

interface ChatViewProps {
  runHistory: RunSummary[];
  initialMessage?: string | null;
  currentPosition: { lat: number; long: number };
}

interface Message {
  role: 'user' | 'model';
  text: string;
  groundingChunks?: any[];
}

export const ChatView: React.FC<ChatViewProps> = ({ runHistory, initialMessage, currentPosition }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    chatService.initialize(runHistory);
    // Set an initial greeting from the model
    setMessages([{ role: 'model', text: 'Genesis AI initialized. Ready to analyze telemetry or assist with navigation.' }]);
  }, [runHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(textToSend, currentPosition);
      const modelMessage: Message = { role: 'model', text: response.text, groundingChunks: response.groundingChunks };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = { role: 'model', text: 'Communications link unstable. Please retry.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialMessage) {
        handleSend(initialMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleSend();
  }

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-2xl overflow-hidden border border-white/5">
      <header className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
          <div className={`p-2 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30`}>
              <ChatIcon className="w-5 h-5" />
          </div>
          <div>
              <h2 className={`text-lg font-bold font-orbitron ${theme.colors.primary}`}>Genesis AI Link</h2>
              <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-gray-400 font-mono tracking-widest">ONLINE</span>
              </div>
          </div>
      </header>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                msg.role === 'user'
                  ? `bg-gradient-to-br ${theme.colors.button} to-cyan-800 text-white rounded-tr-sm`
                  : 'bg-slate-800/80 text-gray-200 border border-white/10 rounded-tl-sm backdrop-blur-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                  {msg.groundingChunks.map((chunk, i) => {
                    if (chunk.maps) {
                      return (
                        <a
                          key={i}
                          href={chunk.maps.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-black/30 text-cyan-300 px-2.5 py-1.5 rounded-md hover:bg-black/50 transition-colors border border-cyan-500/20"
                        >
                          <PinIcon className="w-3 h-3" />
                          <span className="font-semibold text-xs">{chunk.maps.title}</span>
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex justify-start">
              <div className="bg-slate-800/80 p-4 rounded-2xl rounded-tl-sm border border-white/10 flex items-center space-x-2">
                 <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-150"></div>
                 <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white/5 border-t border-white/10">
        <form onSubmit={handleFormSubmit} className="flex gap-2 relative">
            <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Query telemetry or navigation..."
            disabled={isLoading}
            className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans"
            />
            <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`px-5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg ${theme.colors.button} ${theme.colors.buttonHover}`}
            >
            SEND
            </button>
        </form>
      </div>
    </div>
  );
};
