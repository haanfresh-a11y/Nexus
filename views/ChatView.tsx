import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Globe, Loader2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, type GenerateContentResponse, type Part } from '@google/genai';
import { ChatMessage } from '../types';

const ChatView: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userParts: Part[] = [];
    if (input.trim()) userParts.push({ text: input });
    
    // Process image if exists
    let base64Image: string | null = null;
    let mimeType: string | null = null;

    if (selectedImage) {
      base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedImage);
      });
      // Remove data URL prefix
      const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Image = matches[2];
        userParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        });
      }
    }

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: userParts,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    clearImage();
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config: any = {
        model: selectedImage ? 'gemini-2.5-flash' : 'gemini-2.5-flash',
      };
      
      // Add tools if search is enabled (only valid for text-only prompts generally, but flash supports mixed)
      if (useSearch && !selectedImage) {
        config.config = { tools: [{ googleSearch: {} }] };
      }

      // Stream response
      const responseStream = await ai.models.generateContentStream({
        model: config.model,
        contents: {
            parts: userParts
        },
        ...config.config ? { config: config.config } : {}
      });

      const modelMsgId = (Date.now() + 1).toString();
      let accumulatedText = '';
      
      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: 'model',
        parts: [{ text: '' }],
        timestamp: Date.now()
      }]);

      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        const textChunk = c.text || '';
        accumulatedText += textChunk;
        
        // Check for grounding
        const grounding = c.candidates?.[0]?.groundingMetadata;
        let groundingText = '';
        if (grounding?.groundingChunks) {
            // Simply append sources if available at the end (simplified visualization)
            // In a real app we'd parse inline, but for now we trust the model's text 
            // and maybe append sources at the very end of the stream if needed.
            // For now, let's just rely on the model integrating it or the text output.
        }

        setMessages(prev => prev.map(msg => 
          msg.id === modelMsgId 
            ? { ...msg, parts: [{ text: accumulatedText + groundingText }] }
            : msg
        ));
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        parts: [{ text: "I'm sorry, I encountered an error processing your request." }],
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
            <Bot className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">How can I help you today?</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-4xl mx-auto w-full`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-nexus-600' : 'bg-slate-700'
            }`}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-nexus-300" />}
            </div>
            
            <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-nexus-600/20 text-slate-100 border border-nexus-500/30' 
                  : msg.isError 
                    ? 'bg-red-900/20 border border-red-500/30 text-red-200'
                    : 'bg-slate-800/50 text-slate-200 border border-slate-700'
              }`}>
                {msg.parts.map((part, idx) => {
                    if (part.inlineData) {
                        return (
                            <img 
                                key={idx} 
                                src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                                alt="User upload" 
                                className="max-w-xs rounded-lg mb-2"
                            />
                        )
                    }
                    return (
                        <div key={idx} className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{part.text || ''}</ReactMarkdown>
                        </div>
                    )
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-800 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {previewUrl && (
            <div className="relative inline-block">
              <img src={previewUrl} alt="Preview" className="h-20 rounded-lg border border-slate-700" />
              <button 
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-1 border border-slate-600 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2 focus-within:ring-2 focus-within:ring-nexus-500/50 focus-within:border-nexus-500/50 transition-all">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-nexus-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Add image"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />

            <button
              onClick={() => setUseSearch(!useSearch)}
              className={`p-2 rounded-lg transition-colors ${
                useSearch 
                  ? 'text-nexus-400 bg-nexus-500/10' 
                  : 'text-slate-400 hover:text-nexus-400 hover:bg-slate-800'
              }`}
              title="Toggle Google Search"
            >
              <Globe className="w-5 h-5" />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-500 focus:ring-0 resize-none max-h-32 py-2"
              rows={1}
            />

            <button
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className={`p-2 rounded-lg transition-all ${
                isLoading || (!input.trim() && !selectedImage)
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-nexus-600 text-white hover:bg-nexus-500 shadow-lg shadow-nexus-500/20'
              }`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex justify-between items-center text-xs text-slate-500 px-1">
             <span>Model: {selectedImage ? 'Gemini 2.5 Flash (Multimodal)' : 'Gemini 2.5 Flash'}</span>
             {useSearch && <span className="flex items-center gap-1 text-nexus-400"><Globe className="w-3 h-3"/> Grounded with Google Search</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;