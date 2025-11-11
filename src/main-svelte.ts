import { setDeviceOrientation } from '@apps-in-toss/web-framework';
import { sceneState } from './stores/sceneStore';
import TitleScene from './components/TitleScene.svelte';
import GameScene from './components/GameScene.svelte';
import { soundSystem } from './systems/soundSystem';

console.log('Main app initialized');

const ensureOrientation = (type: 'portrait' | 'landscape') => {
  setDeviceOrientation({ type }).catch(error => {
    console.warn('Failed to set device orientation:', type, error);
  });
};

// 기본 화면은 세로 모드 유지
ensureOrientation('portrait');

type AudioFocusEvent = { hasAudioFocus: boolean };

const registerAudioFocusListener = (handler: (event: AudioFocusEvent) => void) => {
  const possibleBridge =
    (window as any)?.toss?.events?.onAudioFocusChanged ??
    (window as any)?.onAudioFocusChanged ??
    (window as any)?.TossWebBridge?.onAudioFocusChanged;

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
  console.log('Title scene mounted');
}

// Game scene mount (hidden initially)
const gameRoot = document.getElementById('game-root');
if (gameRoot) {
  let gameInstance: GameScene | null = null;

  sceneState.subscribe(state => {
    console.log('Scene changed to:', state);

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
          console.log('Game scene mounted');
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

  console.log('Scene manager initialized');

  window.addEventListener('beforeunload', () => {
    ensureOrientation('portrait');
  });
} else {
  console.error('game-root 엘리먼트를 찾을 수 없습니다.');
}

