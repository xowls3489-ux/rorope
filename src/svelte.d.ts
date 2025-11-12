declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';
  export default class extends SvelteComponent<any, any, any> {}
}

// PixiJS 확장 타입
interface PlatformGraphics extends PIXI.Graphics {
  inUse?: boolean;
  isMoving?: boolean;
  moveSpeed?: number;
  moveRange?: number;
  moveDirection?: number;
  originalX?: number;
}

interface StarGraphics extends PIXI.Graphics {
  baseX?: number;
  twinklePhase?: number;
}

interface CloudSprite extends PIXI.Sprite {
  baseX?: number;
}

// Toss WebBridge 인터페이스
interface TossWebBridge {
  onAudioFocusChanged?: (focused: boolean) => void;
}

interface TossEvents {
  onAudioFocusChanged?: (focused: boolean) => void;
}

interface TossAPI {
  events?: TossEvents;
}

declare global {
  interface Window {
    gameInstance?: import('./core/GameManager').GameManager;
    toss?: TossAPI;
    onAudioFocusChanged?: (focused: boolean) => void;
    TossWebBridge?: TossWebBridge;
  }
}
