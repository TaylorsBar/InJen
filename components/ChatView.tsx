
import React, { useState, useEffect, useRef } from 'react';
import { RunSummary } from '../types';
import { chatService } from '../services/chatService';
import { ChatIcon, PinIcon } from './icons';

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

  useEffect(() => {
    chatService.initialize(runHistory);
    // Set an initial greeting from the model
    setMessages([{ role: 'model', text: 'Hello! I am the Genesis AI assistant. How can I help you analyze your runs or find something nearby?' }]);
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
      const errorMessage: Message = { role: 'model', text: 'Sorry, I encountered an error. Please try again.' };
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
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-bold font-orbitron text-cyan-400 border-b border-cyan-500/20 pb-1 mb-2">
        AI Assistant
      </h2>
      <div className="flex-grow overflow-y-auto pr-1 space-y-3">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-7 h-7 flex-shrink-0 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                <ChatIcon className="w-4 h-4 text-cyan-300" />
              </div>
            )}
            <div
              className={`max-w-md p-2.5 rounded-lg glass-pane ${
                msg.role === 'user'
                  ? 'bg-slate-700/80 text-white'
                  : 'text-gray-300'
              }`}
            >
              <p className="whitespace-pre-wrap leading-snug">{msg.text}</p>
              {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                  {msg.groundingChunks.map((chunk, i) => {
                    if (chunk.maps) {
                      return (
                        <a
                          key={i}
                          href={chunk.maps.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-md hover:bg-cyan-500/40 transition-colors"
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
           <div className="flex items-start gap-2">
              <div className="w-7 h-7 flex-shrink-0 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                <ChatIcon className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="max-w-md p-2.5 rounded-lg glass-pane flex items-center space-x-2">
                 <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse delay-75"></div>
                 <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse delay-150"></div>
                 <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse delay-300"></div>
              </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleFormSubmit} className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about runs or find a place..."
          disabled={isLoading}
          className="flex-grow glass-pane border-transparent rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-shadow"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-cyan-500 text-slate-900 font-bold px-4 py-2 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-cyan-400 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};
