<script>
  import { onMount, onDestroy } from 'svelte';
  import { initGame } from '../game';

  let titleInstance = null;
  let gameContainer = null;

  onMount(async () => {
    console.log('GameScene mounted - initializing PixiJS game...');
    
    // Game scene mount
    gameContainer = document.getElementById('game-root');
    if (gameContainer) {
      // PixiJS 게임 초기화
      try {
        const gameInstance = await initGame();
        console.log('PixiJS game initialized:', gameInstance);
        
        // 게임 시작
        if (gameInstance && typeof gameInstance.startGameFromUI === 'function') {
          await new Promise(resolve => setTimeout(resolve, 200));
          gameInstance.startGameFromUI();
          console.log('Game started!');
        } else {
          console.error('Game instance does not have startGameFromUI method');
        }
      } catch (error) {
        console.error('Failed to initialize game:', error);
      }
    }
  });

  onDestroy(() => {
    console.log('GameScene destroyed - cleaning up PixiJS...');
    
    // PixiJS 앱 정리
    if (window.gameInstance && window.gameInstance.app) {
      const app = window.gameInstance.app;
      
      // Ticker 정지
      if (app.ticker) {
        app.ticker.stop();
      }
      
      // 애플리케이션 파괴 (자동으로 리스너 정리됨)
      app.destroy(true);
      
      // DOM에서 캔버스 제거
      if (gameContainer) {
        gameContainer.innerHTML = '';
      }
      
      // 전역 인스턴스 초기화
      window.gameInstance = null;
    }
    
    console.log('PixiJS cleanup complete');
  });
</script>

<!-- 이 컴포넌트는 DOM을 렌더링하지 않고, 
     PixiJS 캔버스가 game-root에 직접 마운트됩니다 -->

