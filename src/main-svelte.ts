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
} else {
  console.error('game-root 엘리먼트를 찾을 수 없습니다.');
}

