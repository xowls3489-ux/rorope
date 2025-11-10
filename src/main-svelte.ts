import { sceneState } from './stores/sceneStore';
import TitleScene from './components/TitleScene.svelte';
import GameScene from './components/GameScene.svelte';

console.log('Main app initialized');

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
  
  // Orientation overlay setup
  const orientationStyle = document.createElement('style');
  orientationStyle.innerHTML = `
    #orientation-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.85);
      color: #ffffff;
      z-index: 9999;
      flex-direction: column;
      text-align: center;
      padding: 24px;
      font-family: 'Noto Sans KR', sans-serif;
      font-size: 1.25rem;
      line-height: 1.6;
    }
    #orientation-overlay .icon {
      font-size: 3rem;
      margin-bottom: 20px;
    }
  `;
  document.head.appendChild(orientationStyle);

  const orientationOverlay = document.createElement('div');
  orientationOverlay.id = 'orientation-overlay';
  orientationOverlay.innerHTML = `
    <div class="icon">📱</div>
    <div>더 나은 게임 플레이를 위해</div>
    <div>기기를 가로 모드로 돌려 주세요.</div>
  `;
  document.body.appendChild(orientationOverlay);

  const updateOrientation = () => {
    const isPortrait = window.innerHeight >= window.innerWidth;
    orientationOverlay.style.display = isPortrait ? 'flex' : 'none';

    if (gameRoot) {
      gameRoot.style.pointerEvents = isPortrait ? 'none' : '';
    }

    if (titleRoot) {
      titleRoot.style.pointerEvents = isPortrait ? 'none' : '';
    }
  };

  updateOrientation();
  const resizeHandler = () => updateOrientation();
  const orientationHandler = () => updateOrientation();
  window.addEventListener('resize', resizeHandler);
  window.addEventListener('orientationchange', orientationHandler);

  // Subscribe to scene changes
  sceneState.subscribe(state => {
    console.log('Scene changed to:', state);
    
    if (state === 'game') {
      // Unmount title and mount game
      if (titleRoot) {
        titleRoot.classList.add('hidden');
        titleRoot.innerHTML = ''; // 완전히 제거
      }
      
      if (gameRoot) {
        gameRoot.classList.remove('hidden');
        gameRoot.style.display = 'flex'; // flex로 복원
        if (!gameInstance) {
          gameInstance = new GameScene({ target: gameRoot });
          console.log('Game scene mounted');
        }
      }
    } else if (state === 'title') {
      // Unmount game and mount title
      if (gameRoot) {
        gameRoot.classList.add('hidden');
        // GameScene의 onDestroy에서 cleanup 처리
      }
      
      if (titleRoot) {
        titleRoot.classList.remove('hidden');
        titleRoot.style.display = 'flex'; // flex로 복원
        if (titleRoot.innerHTML === '') {
          new TitleScene({ target: titleRoot });
        }
      }
      
      gameInstance = null;
    }
  });
  
  console.log('Scene manager initialized');

  window.addEventListener('beforeunload', () => {
    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('orientationchange', orientationHandler);
  });
} else {
  console.error('game-root 엘리먼트를 찾을 수 없습니다.');
}

