import { atom, map } from 'nanostores';
import * as PIXI from 'pixi.js';
import { userManager } from '../managers/UserManager';
import { logger } from '../utils/logger';

// 게임 상태 인터페이스
export interface GameState {
  isPlaying: boolean;
  isSwinging: boolean;
  isPaused: boolean; // 일시정지 상태
  score: number;
  cameraX: number;
  lastPlatformX: number;
  gameOver: boolean;
  combo: number; // 현재 콤보 카운터
  roundMaxCombo: number; // 이번 라운드 최고 콤보
  isSlowMotion: boolean; // 슬로우 모션 활성화 여부
  lastComboMilestone: number; // 마지막 슬로우 모션 발동 콤보
  isInvincible: boolean; // 무적 모드 (별 파워업)
  highScore: number; // 최고 점수 (미터)
  maxCombo: number; // 역대 최고 콤보
  isNewRecord: boolean; // 신기록 달성 여부
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

// localStorage 헬퍼 함수 (사용자별 저장을 위해 UserManager 사용)
const loadHighScore = (): number => {
  return userManager.loadNumber('rorope_highScore', 0);
};

const loadMaxCombo = (): number => {
  return userManager.loadNumber('rorope_maxCombo', 0);
};

const saveHighScore = (score: number): void => {
  userManager.saveData('rorope_highScore', score);
};

const saveMaxCombo = (combo: number): void => {
  userManager.saveData('rorope_maxCombo', combo);
};

// 게임 상태 스토어
export const gameState = map<GameState>({
  isPlaying: false,
  isSwinging: false,
  isPaused: false, // 일시정지 상태
  score: 0,
  cameraX: 0,
  lastPlatformX: 0,
  gameOver: false,
  combo: 0,
  roundMaxCombo: 0, // 이번 라운드 최고 콤보
  isSlowMotion: false,
  lastComboMilestone: 0,
  isInvincible: false,
  highScore: loadHighScore(), // localStorage에서 로드
  maxCombo: loadMaxCombo(), // localStorage에서 로드
  isNewRecord: false
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
    gameState.setKey('combo', 0);
    gameState.setKey('roundMaxCombo', 0); // 이번 라운드 최고 콤보 초기화
    gameState.setKey('isSlowMotion', false);
    gameState.setKey('lastComboMilestone', 0);
    gameState.setKey('isInvincible', false);
    gameState.setKey('isNewRecord', false); // 신기록 플래그 초기화
    
    // 플레이어 위치는 플랫폼 생성 후 GameManager에서 설정
    // 여기서는 기본값만 설정 (실제 위치는 나중에 업데이트됨)
    playerState.setKey('velocityX', 0);
    playerState.setKey('velocityY', 0);
    playerState.setKey('swingAngle', 0);
    playerState.setKey('angularVelocity', 0);
    
    ropeState.setKey('isActive', false);
    platforms.set([]);
  },

  endGame: (finalScore?: number) => {
    const state = gameState.get();
    // finalScore가 전달되면 사용, 아니면 기존 score 사용
    const currentScore = finalScore !== undefined ? finalScore : state.score;
    const roundMaxCombo = state.roundMaxCombo; // 이번 라운드 최고 콤보
    let isNewRecord = false;
    
    // 최종 점수를 gameState에 저장
    gameState.setKey('score', currentScore);
    
    // 최고 점수 갱신 체크
    if (currentScore > state.highScore) {
      gameState.setKey('highScore', currentScore);
      saveHighScore(currentScore);
      isNewRecord = true;
      logger.log(`🎉 신기록! 점수: ${state.highScore} → ${currentScore}`);
    }
    
    // 최고 콤보 갱신 체크 (이번 라운드 최고 콤보와 비교)
    if (roundMaxCombo > state.maxCombo) {
      gameState.setKey('maxCombo', roundMaxCombo);
      saveMaxCombo(roundMaxCombo);
      isNewRecord = true;
      logger.log(`🎉 신기록! 콤보: ${state.maxCombo} → ${roundMaxCombo}`);
    }
    
    gameState.setKey('isNewRecord', isNewRecord);
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

  resetRecords: () => {
    userManager.removeData('rorope_highScore');
    userManager.removeData('rorope_maxCombo');

    gameState.setKey('highScore', 0);
    gameState.setKey('maxCombo', 0);
    gameState.setKey('isNewRecord', false);
  },

  attachRope: (x: number, y: number, length: number) => {
    ropeState.setKey('anchorX', x);
    ropeState.setKey('anchorY', y);
    ropeState.setKey('length', Math.max(1, length));
    gameState.setKey('isSwinging', true);
    ropeState.setKey('isActive', true);
    ropeState.setKey('isFlying', false);
    ropeState.setKey('isPulling', false);
    // 로프 연결 시 스윙 물리 상태 리셋 (기존 각속도/각도 초기화로 가속 버그 방지)
    playerState.setKey('swingAngle', 0);
    playerState.setKey('angularVelocity', 0);
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
    gameState.setKey('isPaused', true);
  },
  
  resumeGame: () => {
    gameState.setKey('isPaused', false);
  },

  addCombo: () => {
    const state = gameState.get();
    const newCombo = state.combo + 1;
    gameState.setKey('combo', newCombo);
    
    // 이번 라운드 최고 콤보 업데이트
    if (newCombo > state.roundMaxCombo) {
      gameState.setKey('roundMaxCombo', newCombo);
    }
  },

  resetCombo: () => {
    gameState.setKey('combo', 0);
  },

  activateSlowMotion: () => {
    gameState.setKey('isSlowMotion', true);
  },

  deactivateSlowMotion: () => {
    gameState.setKey('isSlowMotion', false);
  },

  updateComboMilestone: (milestone: number) => {
    gameState.setKey('lastComboMilestone', milestone);
  },

  activateInvincible: () => {
    gameState.setKey('isInvincible', true);
  },

  deactivateInvincible: () => {
    gameState.setKey('isInvincible', false);
  }
};
