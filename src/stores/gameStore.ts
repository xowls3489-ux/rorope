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
  length: 0
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
