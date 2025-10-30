import { atom, map } from 'nanostores';
import * as PIXI from 'pixi.js';

// 게임 상태 인터페이스
export interface GameState {
  isPlaying: boolean;
  isSwinging: boolean;
  score: number;
  cameraX: number;
  lastPlatformX: number;
  gameOver: boolean;
}

// 플레이어 상태 인터페이스
export interface PlayerState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  swingAngle: number;
  angularVelocity: number;
}

// 로프 상태 인터페이스
export interface RopeState {
  isActive: boolean;
  anchorX: number;
  anchorY: number;
  length: number;
  // grappling hook flight state
  isFlying?: boolean;
  tipX?: number;
  tipY?: number;
  dirX?: number;
  dirY?: number;
  speed?: number;
  maxLength?: number;
  // pulling state (anchor attached, pulling player to anchor)
  isPulling?: boolean;
  pullSpeed?: number;
}

// 게임 상태 스토어
export const gameState = map<GameState>({
  isPlaying: false,
  isSwinging: false,
  score: 0,
  cameraX: 0,
  lastPlatformX: 0,
  gameOver: false
});

// 플레이어 상태 스토어
export const playerState = map<PlayerState>({
  x: 100,
  y: 450,
  velocityX: 0,
  velocityY: 0,
  swingAngle: 0,
  angularVelocity: 0
});

// 로프 상태 스토어
export const ropeState = map<RopeState>({
  isActive: false,
  anchorX: 0,
  anchorY: 0,
  length: 0,
  isFlying: false,
  tipX: 0,
  tipY: 0,
  dirX: 0,
  dirY: 0,
  speed: 0,
  maxLength: 600,
  isPulling: false,
  pullSpeed: 1200
});

// 플랫폼 배열 스토어
export const platforms = atom<PIXI.Graphics[]>([]);

// 게임 액션들
export const gameActions = {
  startGame: () => {
    gameState.setKey('isPlaying', true);
    gameState.setKey('isSwinging', false);
    gameState.setKey('score', 0);
    gameState.setKey('cameraX', 0);
    gameState.setKey('lastPlatformX', 0);
    gameState.setKey('gameOver', false);
    
    playerState.setKey('x', 100);
    playerState.setKey('y', 450);
    playerState.setKey('velocityX', 0);
    playerState.setKey('velocityY', 0);
    playerState.setKey('swingAngle', 0);
    playerState.setKey('angularVelocity', 0);
    
    ropeState.setKey('isActive', false);
    platforms.set([]);
  },

  endGame: () => {
    gameState.setKey('isPlaying', false);
    gameState.setKey('gameOver', true);
  },

  addScore: (points: number = 1) => {
    const currentScore = gameState.get().score;
    gameState.setKey('score', currentScore + points);
  },

  setSwinging: (swinging: boolean) => {
    gameState.setKey('isSwinging', swinging);
    ropeState.setKey('isActive', swinging);
  },

  updatePlayerPosition: (x: number, y: number) => {
    playerState.setKey('x', x);
    playerState.setKey('y', y);
  },

  updatePlayerVelocity: (velocityX: number, velocityY: number) => {
    playerState.setKey('velocityX', velocityX);
    playerState.setKey('velocityY', velocityY);
  },

  updateSwingPhysics: (angle: number, angularVelocity: number) => {
    playerState.setKey('swingAngle', angle);
    playerState.setKey('angularVelocity', angularVelocity);
  },

  setRopeAnchor: (x: number, y: number) => {
    ropeState.setKey('anchorX', x);
    ropeState.setKey('anchorY', y);
  },

  attachRope: (x: number, y: number, length: number) => {
    ropeState.setKey('anchorX', x);
    ropeState.setKey('anchorY', y);
    ropeState.setKey('length', Math.max(1, length));
    gameState.setKey('isSwinging', true);
    ropeState.setKey('isActive', true);
    ropeState.setKey('isFlying', false);
    ropeState.setKey('isPulling', false);
  },

  // launch rope as a projectile (grappling hook)
  launchRope: (startX: number, startY: number, dirX: number, dirY: number, speed: number, maxLength: number) => {
    ropeState.setKey('isActive', true);
    ropeState.setKey('isFlying', true);
    ropeState.setKey('tipX', startX);
    ropeState.setKey('tipY', startY);
    ropeState.setKey('dirX', dirX);
    ropeState.setKey('dirY', dirY);
    ropeState.setKey('speed', speed);
    ropeState.setKey('maxLength', maxLength);
  },

  updateRopeTip: (x: number, y: number) => {
    ropeState.setKey('tipX', x);
    ropeState.setKey('tipY', y);
  },

  stopRopeFlight: () => {
    ropeState.setKey('isFlying', false);
    ropeState.setKey('isActive', false);
  },

  startPull: (speed: number = 1200) => {
    ropeState.setKey('isActive', true);
    ropeState.setKey('isFlying', false);
    ropeState.setKey('isPulling', true);
    ropeState.setKey('pullSpeed', speed);
    gameState.setKey('isSwinging', false);
  },

  stopPull: () => {
    ropeState.setKey('isPulling', false);
  },

  updateCamera: (cameraX: number) => {
    gameState.setKey('cameraX', cameraX);
    gameState.setKey('lastPlatformX', cameraX);
  },

  addPlatform: (platform: PIXI.Graphics) => {
    const currentPlatforms = platforms.get();
    platforms.set([...currentPlatforms, platform]);
  },

  removePlatform: (platform: PIXI.Graphics) => {
    const currentPlatforms = platforms.get();
    const filteredPlatforms = currentPlatforms.filter(p => p !== platform);
    platforms.set(filteredPlatforms);
  },

  clearPlatforms: () => {
    platforms.set([]);
  },

  pauseGame: () => {
    gameState.setKey('isPlaying', false);
  }
};
