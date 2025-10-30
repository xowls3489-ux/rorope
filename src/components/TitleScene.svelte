<script>
  import { onMount, onDestroy } from 'svelte';
  import { sceneActions } from '../stores/sceneStore';
  import { soundSystem } from '../systems/soundSystem';

  let soundEnabled = true;
  let volume = 0.5;

  function toggleSound() {
    soundEnabled = !soundEnabled;
    soundSystem.setVolume(soundEnabled ? volume : 0);
  }

  function adjustVolume(event) {
    volume = parseFloat(event.target.value);
    if (soundEnabled) {
      soundSystem.setVolume(volume);
    }
  }

  async function startGame() {
    console.log('Start Game 버튼 클릭됨!');
    
    // 1. AudioContext 재개 (user gesture)
    if (soundSystem && typeof soundSystem.unlock === 'function') {
      await soundSystem.unlock();
    }
    
    // 2. 씬 전환
    sceneActions.goToGame();
  }
</script>

<div class="start-screen">
  <div class="start-content">
    <h1>바밧줄</h1>
    <button class="start-btn" on:click={startGame}>
      Start
    </button>
  </div>
</div>

<style>
  .start-screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000000; /* 검정 배경 */
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: auto;
  }

  .start-content {
    text-align: center;
    color: #FFFFFF; /* 흰색 텍스트 */
  }

  .start-content h1 {
    font-family: 'Pretendard', 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 4rem;
    font-weight: 800;
    margin: 0 0 40px 0;
    letter-spacing: -0.02em;
  }

  .start-btn {
    font-family: 'Pretendard', 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #FFFFFF; /* 흰색 배경 */
    border: 2px solid #FFFFFF;
    color: #000000; /* 검정 텍스트 */
    padding: 18px 40px;
    font-size: 1.3rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .start-btn:hover {
    background: #000000;
    color: #FFFFFF;
  }

  .start-btn:active {
    transform: scale(0.98);
  }

  @media (max-width: 768px) {
    .start-content h1 {
      font-size: 2.5rem;
    }

    .start-btn {
      padding: 16px 32px;
      font-size: 1.1rem;
    }
  }
</style>

