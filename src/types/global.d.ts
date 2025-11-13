import * as PIXI from 'pixi.js';

type AudioFocusHandler = (event: { hasAudioFocus: boolean }) => void;

declare global {
  interface Window {
    gameInstance?: any;
    toss?: {
      events?: {
        onAudioFocusChanged?: (handler: AudioFocusHandler) => void;
      };
    };
    onAudioFocusChanged?: (handler: AudioFocusHandler) => void;
    TossWebBridge?: {
      onAudioFocusChanged?: (handler: AudioFocusHandler) => void;
    };
  }
}

// Extended PIXI types for game objects
declare module 'pixi.js' {
  interface Graphics {
    baseX?: number;
    twinklePhase?: number;
  }

  interface Sprite {
    baseX?: number;
  }
}

export {};
