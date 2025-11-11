<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { initGameManager } from '../core/GameManager';
  import PauseModal from './PauseModal.svelte';
  import GameOverModal from './GameOverModal.svelte';

  type GameOverOverlayState = {
    open: boolean;
    score: number;
    bestScore: number;
    combo: number;
    bestCombo: number;
    isNewRecord: boolean;
  };

  let titleInstance = null;
  let gameContainer = null;

  let showTutorial = false;
  let tutorialMode: 'intro' | 'replay' = 'intro';
  let gameInstanceRef: any = null;

  let pauseModalOpen = false;
  let pauseSoundEnabled = true;

  const createInitialGameOverState = (): GameOverOverlayState => ({
    open: false,
    score: 0,
    bestScore: 0,
    combo: 0,
    bestCombo: 0,
    isNewRecord: false
  });

  let gameOverOverlay: GameOverOverlayState = createInitialGameOverState();

  const startGame = async () => {
    if (gameInstanceRef && typeof gameInstanceRef.startGameFromUI === 'function') {
      await new Promise(resolve => setTimeout(resolve, 200));
      gameInstanceRef.startGameFromUI();
      console.log('Game started!');
    } else {
      console.error('Game instance does not have startGameFromUI method');
    }
  };

  const dismissTutorial = async () => {
    localStorage.setItem('tutorialSeen_v1', 'true');
    showTutorial = false;

    if (tutorialMode === 'intro') {
      await startGame();
    }

    window.dispatchEvent(
      new CustomEvent('tutorial-dismissed', { detail: { mode: tutorialMode } })
    );

    tutorialMode = 'intro';
  };

  const handleTutorialShow = (event: Event) => {
    const detail = (event as CustomEvent<{ mode?: 'intro' | 'replay' }>).detail;
    tutorialMode = detail?.mode === 'intro' ? 'intro' : 'replay';
    showTutorial = true;
  };

  const handlePauseOpenEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ soundEnabled?: boolean }>).detail;
    if (typeof detail?.soundEnabled === 'boolean') {
      pauseSoundEnabled = detail.soundEnabled;
    }
    pauseModalOpen = true;
  };

  const handlePauseCloseEvent = () => {
    pauseModalOpen = false;
  };

  const handleSoundChangedEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ soundEnabled?: boolean }>).detail;
    if (typeof detail?.soundEnabled === 'boolean') {
      pauseSoundEnabled = detail.soundEnabled;
    }
  };

  const handleGameOverOpenEvent = (event: Event) => {
    const detail =
      (event as CustomEvent<Partial<GameOverOverlayState>>).detail ?? {};
    gameOverOverlay = {
      open: true,
      score: detail.score ?? 0,
      bestScore: detail.bestScore ?? 0,
      combo: detail.combo ?? 0,
      bestCombo: detail.bestCombo ?? 0,
      isNewRecord: Boolean(detail.isNewRecord)
    };
  };

  const handleGameOverCloseEvent = () => {
    gameOverOverlay = createInitialGameOverState();
  };

  const handlePauseResume = () => {
    const manager = gameInstanceRef?.getUIManager?.();
    manager?.requestResumeFromOverlay?.();
  };

  const handlePauseSoundToggle = () => {
    const manager = gameInstanceRef?.getUIManager?.();
    manager?.requestSoundToggleFromOverlay?.();
  };

  const handlePauseShowTutorial = () => {
    const manager = gameInstanceRef?.getUIManager?.();
    manager?.requestTutorialFromOverlay?.();
  };

  const handlePauseResetRecords = () => {
    const manager = gameInstanceRef?.getUIManager?.();
    manager?.requestResetRecordsFromOverlay?.();
  };

  const handleGameOverRetry = () => {
    if (gameInstanceRef && typeof gameInstanceRef.restartGameFromUI === 'function') {
      gameInstanceRef.restartGameFromUI();
    }
    gameOverOverlay = { ...gameOverOverlay, open: false };
  };

  onMount(async () => {
    console.log('GameScene mounted - initializing PixiJS game...');

    gameContainer = document.getElementById('game-root');
    if (!gameContainer) {
      console.error('game-root 엘리먼트를 찾을 수 없습니다.');
      return;
    }

    try {
      const gameInstance = await initGameManager();
      gameInstanceRef = gameInstance;
      console.log('PixiJS game initialized:', gameInstance);

      window.addEventListener('tutorial-show', handleTutorialShow);
      window.addEventListener('game-ui:pause-open', handlePauseOpenEvent as EventListener);
      window.addEventListener('game-ui:pause-close', handlePauseCloseEvent as EventListener);
      window.addEventListener('game-ui:sound-changed', handleSoundChangedEvent as EventListener);
      window.addEventListener('game-ui:gameover-open', handleGameOverOpenEvent as EventListener);
      window.addEventListener('game-ui:gameover-close', handleGameOverCloseEvent as EventListener);

      try {
        pauseSoundEnabled = localStorage.getItem('soundMuted') !== 'true';
      } catch {
        pauseSoundEnabled = true;
      }

      const tutorialSeen = localStorage.getItem('tutorialSeen_v1') === 'true';
      if (tutorialSeen) {
        await startGame();
      } else {
        tutorialMode = 'intro';
        showTutorial = true;
      }
    } catch (error) {
      console.error('Failed to initialize game:', error);
    }
  });

  onDestroy(() => {
    console.log('GameScene destroyed - cleaning up PixiJS...');

    if (window.gameInstance && window.gameInstance.app) {
      const app = window.gameInstance.app;

      if (app.ticker) {
        app.ticker.stop();
      }

      app.destroy(true);
      window.gameInstance = null;
    }

    console.log('PixiJS cleanup complete');

    window.removeEventListener('tutorial-show', handleTutorialShow);
    window.removeEventListener('game-ui:pause-open', handlePauseOpenEvent as EventListener);
    window.removeEventListener('game-ui:pause-close', handlePauseCloseEvent as EventListener);
    window.removeEventListener('game-ui:sound-changed', handleSoundChangedEvent as EventListener);
    window.removeEventListener('game-ui:gameover-open', handleGameOverOpenEvent as EventListener);
    window.removeEventListener('game-ui:gameover-close', handleGameOverCloseEvent as EventListener);
  });
</script>

{#if showTutorial}
  <div class="tutorial-overlay" on:click={dismissTutorial}>
    <div class="tutorial-card">
      <div class="tutorial-pointer">⬇️</div>
      <h2>첫 플랫폼을 터치하세요</h2>
      <p>화면을 탭하면 로프를 던지고, 밧줄을 잡아 이동할 수 있어요.</p>
      <button type="button" on:click|stopPropagation={dismissTutorial}>
        알겠어요!
      </button>
      <small>다시 보려면 설정에서 튜토리얼을 초기화하세요.</small>
    </div>
  </div>
{/if}

<PauseModal
  open={pauseModalOpen}
  soundEnabled={pauseSoundEnabled}
  on:resume={handlePauseResume}
  on:toggle-sound={handlePauseSoundToggle}
  on:show-tutorial={handlePauseShowTutorial}
  on:reset-records={handlePauseResetRecords}
/>

<GameOverModal
  open={gameOverOverlay.open}
  score={gameOverOverlay.score}
  bestScore={gameOverOverlay.bestScore}
  combo={gameOverOverlay.combo}
  bestCombo={gameOverOverlay.bestCombo}
  isNewRecord={gameOverOverlay.isNewRecord}
  on:retry={handleGameOverRetry}
/>

<style>
  .tutorial-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8vh;
    z-index: 999;
  }

  .tutorial-card {
    background: rgba(15, 15, 18, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 24px 28px;
    max-width: 320px;
    text-align: center;
    color: #fefefe;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  }

  .tutorial-pointer {
    font-size: 32px;
    margin-bottom: 8px;
    animation: bounce 1.4s infinite;
  }

  .tutorial-card h2 {
    font-size: 20px;
    margin-bottom: 12px;
  }

  .tutorial-card p {
    font-size: 15px;
    line-height: 1.4;
    margin-bottom: 20px;
    color: rgba(255, 255, 255, 0.85);
  }

  .tutorial-card button {
    width: 100%;
    padding: 12px 16px;
    background: #ff6f61;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .tutorial-card button:hover {
    background: #ff8a7f;
  }

  .tutorial-card small {
    display: block;
    margin-top: 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }
</style>
