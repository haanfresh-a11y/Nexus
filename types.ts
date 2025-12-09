import { type Part } from '@google/genai';

export enum AppView {
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  STUDIO = 'STUDIO'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  parts: Part[]; // Using the SDK's Part type for consistency
  timestamp: number;
  isError?: boolean;
}

export interface ImageGenerationConfig {
  aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3';
  prompt: string;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
}
