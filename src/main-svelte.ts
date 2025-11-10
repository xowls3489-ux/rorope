import { setDeviceOrientation } from '@apps-in-toss/web-framework';
import { sceneState } from './stores/sceneStore';
import TitleScene from './components/TitleScene.svelte';
import GameScene from './components/GameScene.svelte';

console.log('Main app initialized');

const ensureOrientation = (type: 'portrait' | 'landscape') => {
  setDeviceOrientation({ type }).catch(error => {
    console.warn('Failed to set device orientation:', type, error);
  });
};

// 기본 화면은 세로 모드 유지
ensureOrientation('portrait');

// Title scene mount
const titleRoot = document.getElementById('title-root');
if (titleRoot) {
  const titleInstance = new TitleScene({ target: titleRoot });
  console.log('Title scene mounted');
}

// Game scene mount (hidden initially)
const gameRoot = document.getElementById('game-root');
if (gameRoot) {
  let gameInstance = null;

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

