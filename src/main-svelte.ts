import { logger } from './utils/logger';
import { setDeviceOrientation } from '@apps-in-toss/web-framework';
import { sceneState } from './stores/sceneStore';
import TitleScene from './components/TitleScene.svelte';
import GameScene from './components/GameScene.svelte';
import { soundSystem } from './systems/soundSystem';
import { userManager } from './managers/UserManager';

logger.log('Main app initialized');

// 사용자 인증 초기화 (비동기)
(async () => {
  try {
    await userManager.initialize();
    logger.log('✅ 사용자 인증 초기화 완료');
  } catch (error) {
    console.error('❌ 사용자 인증 초기화 실패:', error);
  }
})();

const ensureOrientation = (type: 'portrait' | 'landscape') => {
  setDeviceOrientation({ type }).catch(error => {
    console.warn('Failed to set device orientation:', type, error);
  });
};

const cssRoot = () => document.documentElement;

const updateViewportVars = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const rightInset = Math.max(0, window.innerWidth - width - offsetLeft);
  const bottomInset = Math.max(0, window.innerHeight - height - offsetTop);

  const rootStyle = cssRoot().style;
  rootStyle.setProperty('--app-vw', `${width}px`);
  rootStyle.setProperty('--app-vh', `${height}px`);
  rootStyle.setProperty('--app-safe-top', `${offsetTop}px`);
  rootStyle.setProperty('--app-safe-left', `${offsetLeft}px`);
  rootStyle.setProperty('--app-safe-right', `${rightInset}px`);
  rootStyle.setProperty('--app-safe-bottom', `${bottomInset}px`);
};

const setupViewportWatcher = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => updateViewportVars();
  handler();

  window.addEventListener('resize', handler, { passive: true });
  window.addEventListener('orientationchange', handler);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', handler, { passive: true });
    vv.addEventListener('scroll', handler, { passive: true });
  }

  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
    if (vv) {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    }
  };
};

// 기본 화면은 세로 모드 유지
ensureOrientation('portrait');
const teardownViewportWatcher = setupViewportWatcher();

type AudioFocusEvent = { hasAudioFocus: boolean };

const registerAudioFocusListener = (handler: (event: AudioFocusEvent) => void) => {
  const possibleBridge =
    window?.toss?.events?.onAudioFocusChanged ??
    window?.onAudioFocusChanged ??
    window?.TossWebBridge?.onAudioFocusChanged;

  if (typeof possibleBridge === 'function') {
    possibleBridge(handler);
    return;
  }

  const dispatch = (visible: boolean) => handler({ hasAudioFocus: visible });

  document.addEventListener('visibilitychange', () => {
    dispatch(document.visibilityState === 'visible');
  });

  window.addEventListener('pagehide', () => {
    dispatch(false);
  });

  window.addEventListener('pageshow', () => {
    dispatch(document.visibilityState === 'visible');
  });
};

registerAudioFocusListener(({ hasAudioFocus }) => {
  if (hasAudioFocus) {
    soundSystem.resumeAfterFocusGain();
  } else {
    soundSystem.pauseForFocusLoss();
  }
});

// Title scene mount
const titleRoot = document.getElementById('title-root');
if (titleRoot) {
  new TitleScene({ target: titleRoot });
  logger.log('Title scene mounted');
}

// Game scene mount (hidden initially)
const gameRoot = document.getElementById('game-root');
if (gameRoot) {
  let gameInstance: GameScene | null = null;

  sceneState.subscribe(state => {
    logger.log('Scene changed to:', state);

    if (state === 'game') {
      ensureOrientation('landscape');

      if (titleRoot) {
        titleRoot.classList.add('hidden');
        titleRoot.innerHTML = '';
      }

      if (gameRoot) {
        gameRoot.classList.remove('hidden');
        gameRoot.style.display = 'flex';
        if (!gameInstance) {
          gameInstance = new GameScene({ target: gameRoot });
          logger.log('Game scene mounted');
        }
      }
    } else if (state === 'title') {
      ensureOrientation('portrait');

      if (gameRoot) {
        gameRoot.classList.add('hidden');
      }

      if (titleRoot) {
        titleRoot.classList.remove('hidden');
        titleRoot.style.display = 'flex';
        if (titleRoot.innerHTML === '') {
          new TitleScene({ target: titleRoot });
        }
      }

      gameInstance = null;
    }
  });

  logger.log('Scene manager initialized');

  window.addEventListener('beforeunload', () => {
    ensureOrientation('portrait');
  });
  window.addEventListener('pagehide', () => teardownViewportWatcher?.());
} else {
  console.error('game-root 엘리먼트를 찾을 수 없습니다.');
}

