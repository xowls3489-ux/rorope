import * as PIXI from 'pixi.js';
import type { GameScene } from '../managers/GameScene';
import type { GameManager } from '../core/GameManager';

type AudioFocusHandler = (event: { hasAudioFocus: boolean }) => void;

declare global {
  interface Window {
    gameInstance?: GameScene | GameManager | null;
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

  interface Container {
    vfxFade?: () => void;
    vfxRipple?: () => void;
    vfxFlash?: () => void;
    vfxShockwave?: () => void;
    vfxExplosionShockwave?: () => void;
  }
}

export {};
