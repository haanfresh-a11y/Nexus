import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ImageGenerationConfig, GeneratedImage } from '../types';
import { Wand2, Download, RefreshCw, LayoutTemplate } from 'lucide-react';

const StudioView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<ImageGenerationConfig['aspectRatio']>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);

  const generateImage = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Using generateContent for nano banana series as per instructions for image gen
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
             aspectRatio: aspectRatio,
          }
        },
      });

      // Extract image
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
          for (const part of parts) {
              if (part.inlineData) {
                  const base64 = part.inlineData.data;
                  const mimeType = part.inlineData.mimeType || 'image/png';
                  const url = `data:${mimeType};base64,${base64}`;
                  setGeneratedImage({
                      url,
                      prompt,
                      timestamp: Date.now()
                  });
                  break; 
              }
          }
      }

    } catch (error) {
      console.error("Image generation failed", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage.url;
      link.download = `nexus-gen-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col md:flex-row">
      
      {/* Controls - Left Panel */}
      <div className="w-full md:w-96 p-6 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col gap-6 bg-slate-900/50">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-nexus-400" />
            Image Studio
          </h2>
          <p className="text-slate-400 text-sm">
            Create visuals with Gemini 2.5 Flash Image.
          </p>
        </div>

        <div className="space-y-4 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A futuristic city with flying cars, neon lights, cyberpunk style..."
              className="w-full h-32 bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-nexus-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" /> Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-3 rounded-md text-xs font-medium border transition-all ${
                    aspectRatio === ratio
                      ? 'bg-nexus-600/20 border-nexus-500 text-nexus-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={generateImage}
          disabled={isGenerating || !prompt}
          className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
            isGenerating || !prompt
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-nexus-600 to-nexus-500 text-white hover:shadow-lg hover:shadow-nexus-500/25'
          }`}
        >
          {isGenerating ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Wand2 className="w-5 h-5" />
          )}
          {isGenerating ? 'Dreaming...' : 'Generate'}
        </button>
      </div>

      {/* Preview - Right Panel */}
      <div className="flex-1 p-6 flex items-center justify-center bg-slate-950 relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #38bdf8 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        </div>

        {generatedImage ? (
          <div className="relative group max-w-full max-h-full">
            <img 
              src={generatedImage.url} 
              alt={generatedImage.prompt}
              className="max-h-[80vh] max-w-full rounded-lg shadow-2xl border border-slate-800"
            />
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={downloadImage}
                className="bg-slate-900/90 hover:bg-black text-white p-3 rounded-full backdrop-blur-sm border border-slate-700 shadow-lg"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-600 space-y-4">
             <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center border-dashed">
                <LayoutTemplate className="w-8 h-8 opacity-50" />
             </div>
             <p>Your creation will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioView;